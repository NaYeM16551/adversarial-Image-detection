"""
Feature Extractor Module
========================
Extracts intermediate features from ViT transformer blocks using
registered forward hooks. Handles preprocessing (resize, normalize)
for ViT-B/16 input requirements.
"""

import torch
from models.vit_loader import get_vit_preprocess


def extract_features(model, image_tensor, hook_dict, device=None):
    """
    Extract intermediate features from ViT for a single image.
    
    Passes the image through the ViT model and captures intermediate
    layer outputs via pre-registered forward hooks.
    
    Args:
        model: ViT model with registered hooks
        image_tensor: (C, H, W) tensor in [0, 1] range (raw, unnormalized)
        hook_dict: dict that gets populated by hooks {layer_idx: output_tensor}
        device: torch device (auto-detected if None)
    
    Returns:
        features: dict of {layer_idx: feature_tensor}
                  Each feature_tensor has shape (1, num_tokens, embed_dim)
                  For ViT-B/16: (1, 197, 768)
    """
    if device is None:
        device = next(model.parameters()).device
    
    # Preprocess: resize to 224x224 and normalize with ImageNet stats
    preprocess = get_vit_preprocess()
    
    # Ensure 4D input: (1, C, H, W)
    if image_tensor.dim() == 3:
        image_tensor = image_tensor.unsqueeze(0)
    
    # Resize and normalize
    processed = preprocess(image_tensor.to(device))
    
    # Clear previous hook outputs
    hook_dict.clear()
    
    # Forward pass — hooks will capture intermediate features
    with torch.no_grad():
        _ = model(processed)
    
    # Copy hook outputs (so they persist after dict is cleared)
    features = {k: v.clone() for k, v in hook_dict.items()}
    
    return features


def extract_cls_features(model, image_tensor, hook_dict, device=None):
    """
    Extract only the CLS token features from intermediate ViT layers.
    
    The CLS token (index 0) is the global representation of the image
    and is more informative for distance computation than patch tokens.
    
    Args:
        model: ViT model with registered hooks
        image_tensor: (C, H, W) tensor in [0, 1] range
        hook_dict: dict populated by hooks
        device: torch device
    
    Returns:
        cls_features: dict of {layer_idx: cls_tensor}
                      Each cls_tensor has shape (1, embed_dim) = (1, 768)
    """
    features = extract_features(model, image_tensor, hook_dict, device)
    
    # Extract CLS token (first token) from each layer
    cls_features = {}
    for layer_idx, feat in features.items():
        # feat shape: (1, num_tokens, embed_dim)
        # CLS token is at index 0
        cls_features[layer_idx] = feat[:, 0, :]  # (1, embed_dim)
    
    return cls_features
