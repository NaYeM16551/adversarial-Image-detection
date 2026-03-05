"""
FGSM Attack Module
==================
Fast Gradient Sign Method — generates adversarial examples by adding
a small perturbation in the direction of the gradient sign.

Attack target: ResNet-18 (CNN)
Detection model: ViT (separate model, not attacked)

Formula: x_adv = x + ε * sign(∇x L(θ, x, y))
"""

import torch
import torch.nn as nn


def fgsm_attack(model, image, label, epsilon=8/255):
    """
    Generate adversarial example using FGSM attack on ResNet-18.
    
    Args:
        model: ResNet-18 model (attack target)
        image: (C, H, W) or (1, C, H, W) tensor in [0, 1] — clean image
        label: integer class label or (1,) tensor
        epsilon: perturbation budget (default: 8/255 ≈ 0.031)
    
    Returns:
        adv_image: (C, H, W) adversarial image tensor in [0, 1]
    """
    # Ensure model is in eval mode (important for correct gradients)
    model.eval()
    
    # Handle dimensions
    squeeze = False
    if image.dim() == 3:
        image = image.unsqueeze(0)
        squeeze = True
    
    if isinstance(label, int):
        label = torch.tensor([label])
    
    device = next(model.parameters()).device
    image = image.clone().to(device)
    label = label.to(device)
    
    # Enable gradient computation on input
    image.requires_grad = True
    
    # Forward pass through ResNet-18
    output = model(image)
    
    # Compute cross-entropy loss
    criterion = nn.CrossEntropyLoss()
    loss = criterion(output, label)
    
    # Backward pass to get gradients w.r.t. input
    model.zero_grad()
    loss.backward()
    
    # Collect gradient sign
    grad_sign = image.grad.data.sign()
    
    # Create adversarial image: x_adv = x + ε * sign(∇x L)
    adv_image = image.data + epsilon * grad_sign
    
    # Clamp to valid pixel range [0, 1]
    adv_image = torch.clamp(adv_image, 0.0, 1.0)
    
    if squeeze:
        adv_image = adv_image.squeeze(0)
    
    return adv_image.detach()
