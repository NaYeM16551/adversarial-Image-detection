"""
Benign Transformations Module
=============================
Provides small benign transformations (Gaussian blur, Gaussian noise, rotation)
used to test feature consistency of clean vs adversarial images.

Clean images remain stable under these transforms; adversarial images show
significant feature drift in the ViT's intermediate layers.
"""

import torch
import torchvision.transforms.functional as TF


def apply_gaussian_blur(image_tensor, kernel_size=3, sigma=0.5):
    """
    Apply Gaussian blur to a tensor image.
    
    Args:
        image_tensor: (C, H, W) or (B, C, H, W) tensor in [0, 1]
        kernel_size: size of the Gaussian kernel (odd number)
        sigma: standard deviation of the Gaussian kernel
    
    Returns:
        Blurred image tensor with same shape
    """
    if image_tensor.dim() == 3:
        # Single image: add batch dim, blur, remove batch dim
        return TF.gaussian_blur(image_tensor.unsqueeze(0), kernel_size, [sigma]).squeeze(0)
    return TF.gaussian_blur(image_tensor, kernel_size, [sigma])


def apply_gaussian_noise(image_tensor, sigma=0.02):
    """
    Add Gaussian noise to a tensor image.
    
    Args:
        image_tensor: (C, H, W) or (B, C, H, W) tensor in [0, 1]
        sigma: standard deviation of the Gaussian noise
    
    Returns:
        Noisy image tensor clamped to [0, 1]
    """
    noise = torch.randn_like(image_tensor) * sigma
    return torch.clamp(image_tensor + noise, 0.0, 1.0)


def apply_rotation(image_tensor, angle=5.0):
    """
    Apply a fixed rotation to a tensor image.
    
    Args:
        image_tensor: (C, H, W) or (B, C, H, W) tensor in [0, 1]
        angle: rotation angle in degrees
    
    Returns:
        Rotated image tensor
    """
    if image_tensor.dim() == 3:
        return TF.rotate(image_tensor.unsqueeze(0), angle).squeeze(0)
    return TF.rotate(image_tensor, angle)


def get_transforms():
    """
    Get a dictionary of all benign transformation functions.
    
    Returns:
        dict: {"blur": fn, "noise": fn, "rotation": fn}
              Each fn takes a tensor image and returns a transformed tensor.
    """
    transforms = {
        "blur": lambda x: apply_gaussian_blur(x, kernel_size=3, sigma=0.5),
        "noise": lambda x: apply_gaussian_noise(x, sigma=0.02),
        "rotation": lambda x: apply_rotation(x, angle=5.0),
    }
    return transforms
