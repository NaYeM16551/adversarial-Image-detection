"""
Feature Distance Module
=======================
Computes L2 and cosine distances between feature representations of
an original image and its transformed version across multiple ViT layers.

Constructs the full 24-dimensional feature consistency score vector:
    4 layers × 2 metrics (L2, cosine) × 3 transforms (blur, noise, rotation)
"""

import torch
import torch.nn.functional as F

from features.feature_extractor import extract_cls_features
from utils.transforms import get_transforms


def compute_l2_distance(feat_a, feat_b):
    """
    Compute L2 (Euclidean) distance between two feature vectors.
    
    Args:
        feat_a: (1, D) tensor
        feat_b: (1, D) tensor
    
    Returns:
        float: L2 distance scalar
    """
    return torch.norm(feat_a - feat_b, p=2).item()


def compute_cosine_distance(feat_a, feat_b):
    """
    Compute cosine distance = 1 - cosine_similarity between two feature vectors.
    
    A value of 0 means identical directions, 1 means orthogonal,
    2 means opposite directions.
    
    Args:
        feat_a: (1, D) tensor
        feat_b: (1, D) tensor
    
    Returns:
        float: cosine distance scalar in [0, 2]
    """
    cos_sim = F.cosine_similarity(feat_a, feat_b, dim=1)
    return (1.0 - cos_sim).item()


def compute_score_vector(model, image_tensor, hook_dict, 
                         transforms_dict=None, hook_layers=None):
    """
    Compute the full feature consistency score vector for an image.
    
    For each benign transformation and each hooked ViT layer, computes
    L2 and cosine distances between original and transformed image features.
    
    Score vector layout (24 dimensions with 4 layers and 3 transforms):
        [blur_L3_L2, blur_L6_L2, blur_L9_L2, blur_L11_L2,
         blur_L3_cos, blur_L6_cos, blur_L9_cos, blur_L11_cos,
         noise_L3_L2, noise_L6_L2, noise_L9_L2, noise_L11_L2,
         noise_L3_cos, noise_L6_cos, noise_L9_cos, noise_L11_cos,
         rot_L3_L2, rot_L6_L2, rot_L9_L2, rot_L11_L2,
         rot_L3_cos, rot_L6_cos, rot_L9_cos, rot_L11_cos]
    
    Args:
        model: ViT model with registered hooks
        image_tensor: (C, H, W) tensor in [0, 1] range
        hook_dict: dict populated by ViT forward hooks
        transforms_dict: dict of {name: transform_fn} (default: all 3 transforms)
        hook_layers: sorted list of hooked layer indices (default: [3, 6, 9, 11])
    
    Returns:
        score_vector: list of floats (24-dimensional by default)
    """
    if transforms_dict is None:
        transforms_dict = get_transforms()
    
    if hook_layers is None:
        hook_layers = sorted(hook_dict.keys()) if hook_dict else [3, 6, 9, 11]
    
    # Extract features for the original image
    original_features = extract_cls_features(model, image_tensor, hook_dict)
    
    score_vector = []
    
    # Process each transformation
    transform_order = ["blur", "noise", "rotation"]
    for t_name in transform_order:
        if t_name not in transforms_dict:
            continue
        
        transform_fn = transforms_dict[t_name]
        
        # Apply benign transformation
        transformed_image = transform_fn(image_tensor)
        
        # Extract features for the transformed image
        transformed_features = extract_cls_features(
            model, transformed_image, hook_dict
        )
        
        # Compute L2 distances for all layers
        for layer_idx in hook_layers:
            l2_dist = compute_l2_distance(
                original_features[layer_idx], 
                transformed_features[layer_idx]
            )
            score_vector.append(l2_dist)
        
        # Compute cosine distances for all layers
        for layer_idx in hook_layers:
            cos_dist = compute_cosine_distance(
                original_features[layer_idx], 
                transformed_features[layer_idx]
            )
            score_vector.append(cos_dist)
    
    return score_vector


def get_score_vector_names(hook_layers=None, transforms_list=None):
    """
    Get human-readable names for each dimension of the score vector.
    Useful for feature importance analysis and debugging.
    
    Returns:
        list of strings, e.g. ["blur_L3_L2", "blur_L6_L2", ...]
    """
    if hook_layers is None:
        hook_layers = [3, 6, 9, 11]
    if transforms_list is None:
        transforms_list = ["blur", "noise", "rotation"]
    
    names = []
    for t_name in transforms_list:
        for layer_idx in hook_layers:
            names.append(f"{t_name}_L{layer_idx}_L2")
        for layer_idx in hook_layers:
            names.append(f"{t_name}_L{layer_idx}_cos")
    
    return names
