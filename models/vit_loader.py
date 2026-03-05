"""
ViT Model Loader (Detection Model)
===================================
Loads a pretrained ViT-B/16 from timm and registers forward hooks on
specified transformer blocks to extract intermediate features.

This model is used ONLY for feature extraction / detection.
Adversarial attacks are NOT performed on this model.
"""

import torch
import timm


def load_vit(model_name="vit_base_patch16_224", pretrained=True, 
             hook_layers=None, device=None):
    """
    Load a pretrained Vision Transformer and register forward hooks.
    
    Args:
        model_name: timm model name (default: vit_base_patch16_224)
        pretrained: whether to load pretrained weights
        hook_layers: list of block indices to hook (default: [3, 6, 9, 11])
        device: torch device (auto-detected if None)
    
    Returns:
        model: ViT model in eval mode on the specified device
        hook_dict: dict mapping layer_idx -> captured features (updated on forward pass)
        hook_handles: list of hook handles (for cleanup)
    """
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    if hook_layers is None:
        hook_layers = [3, 6, 9, 11]
    
    # Load pretrained ViT-B/16
    model = timm.create_model(model_name, pretrained=pretrained)
    model = model.to(device)
    model.eval()
    
    # Freeze all parameters — we never train this model
    for param in model.parameters():
        param.requires_grad = False
    
    # Dictionary to store intermediate features captured by hooks
    hook_dict = {}
    hook_handles = []
    
    def make_hook(layer_idx):
        """Create a hook function that captures the output of a transformer block."""
        def hook_fn(module, input, output):
            # output shape: (batch_size, num_tokens, embed_dim)
            # For ViT-B/16: (B, 197, 768) — 196 patch tokens + 1 CLS token
            hook_dict[layer_idx] = output.detach()
        return hook_fn
    
    # Register hooks on the specified transformer blocks
    for layer_idx in hook_layers:
        if layer_idx < len(model.blocks):
            handle = model.blocks[layer_idx].register_forward_hook(make_hook(layer_idx))
            hook_handles.append(handle)
        else:
            print(f"[WARNING] Layer {layer_idx} does not exist in model "
                  f"(max: {len(model.blocks) - 1}). Skipping.")
    
    print(f"[ViT Loader] Loaded {model_name} on {device}")
    print(f"[ViT Loader] Registered hooks on blocks: {hook_layers}")
    print(f"[ViT Loader] Total parameters: {sum(p.numel() for p in model.parameters()):,}")
    
    return model, hook_dict, hook_handles


def remove_hooks(hook_handles):
    """Remove all registered forward hooks."""
    for handle in hook_handles:
        handle.remove()
    print("[ViT Loader] All hooks removed.")


def get_vit_preprocess():
    """
    Get the standard preprocessing transform for ViT-B/16.
    Expects input in [0, 1] range, resizes to 224x224 and normalizes
    with ImageNet mean/std.
    
    Returns:
        transform: torchvision transform pipeline
    """
    from torchvision import transforms
    
    preprocess = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        ),
    ])
    return preprocess
