"""
PGD Attack Module
=================
Projected Gradient Descent — an iterative extension of FGSM that applies
multiple small gradient-based perturbations while projecting the result
back into an ε-bounded region.

Attack target: ResNet-18 (CNN)
Detection model: ViT (separate model, not attacked)

PGD is stronger than FGSM and produces more robust adversarial examples.
"""

import torch
import torch.nn as nn


def pgd_attack(model, image, label, epsilon=8/255, alpha=2/255, steps=7):
    """
    Generate adversarial example using PGD attack on ResNet-18.
    
    Args:
        model: ResNet-18 model (attack target)
        image: (C, H, W) or (1, C, H, W) tensor in [0, 1] — clean image
        label: integer class label or (1,) tensor
        epsilon: maximum perturbation budget (default: 8/255)
        alpha: step size per iteration (default: 2/255)
        steps: number of PGD iterations (default: 7)
    
    Returns:
        adv_image: (C, H, W) adversarial image tensor in [0, 1]
    """
    # Ensure model is in eval mode
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
    
    criterion = nn.CrossEntropyLoss()
    
    # Random initialization within ε-ball
    adv_image = image.clone()
    random_noise = torch.empty_like(adv_image).uniform_(-epsilon, epsilon)
    adv_image = torch.clamp(adv_image + random_noise, 0.0, 1.0)
    
    # Iterative PGD steps
    for _ in range(steps):
        adv_image.requires_grad = True
        
        # Forward pass through ResNet-18
        output = model(adv_image)
        loss = criterion(output, label)
        
        # Backward pass
        model.zero_grad()
        loss.backward()
        
        # Gradient ascent step: move in direction that increases loss
        grad_sign = adv_image.grad.data.sign()
        adv_image = adv_image.data + alpha * grad_sign
        
        # Project back into ε-ball around original image
        perturbation = torch.clamp(adv_image - image, -epsilon, epsilon)
        adv_image = torch.clamp(image + perturbation, 0.0, 1.0)
    
    if squeeze:
        adv_image = adv_image.squeeze(0)
    
    return adv_image.detach()
