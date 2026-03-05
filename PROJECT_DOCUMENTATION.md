# Adversarial Image Detection via Feature Consistency in Vision Transformers

## Detailed Project Documentation

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Core Hypothesis](#2-core-hypothesis)
3. [System Architecture](#3-system-architecture)
4. [Stage 1 — Benign Transformations](#4-stage-1--benign-transformations)
5. [Stage 2 — Model Loading](#5-stage-2--model-loading)
6. [Stage 3 — Feature Extraction with Forward Hooks](#6-stage-3--feature-extraction-with-forward-hooks)
7. [Stage 4 — Feature Distance Computation](#7-stage-4--feature-distance-computation)
8. [Stage 5 — Adversarial Attack Generation](#8-stage-5--adversarial-attack-generation)
9. [Stage 6 — Score Dataset Construction](#9-stage-6--score-dataset-construction)
10. [Stage 7 — Meta-Classifier Training](#10-stage-7--meta-classifier-training)
11. [Stage 8 — Inference Pipeline](#11-stage-8--inference-pipeline)
12. [Why This Works — Deep Intuition](#12-why-this-works--deep-intuition)
13. [Running the Project](#13-running-the-project)

---

## 1. Problem Statement

Deep neural networks are vulnerable to **adversarial examples** — images with tiny, human-imperceptible perturbations that cause models to misclassify with high confidence. For example, a stop sign with a carefully crafted perturbation might be classified as a speed limit sign by an autonomous vehicle.

**The Research Question:**

> Given a pretrained model deployed in production, can we detect whether a given input image is clean or adversarial — *without retraining the model*?

This is called **post-hoc adversarial example detection**, and it is a critical real-world problem because:
- Models are often deployed as black boxes (pretrained)
- Retraining is expensive or impossible
- We still need to filter out malicious inputs at inference time

---

## 2. Core Hypothesis

**Key Insight: Adversarial perturbations are fragile.**

When you apply a small, harmless transformation to an image (like a tiny blur or rotation):

| Image Type | What Happens |
|------------|-------------|
| **Clean image** | Internal features remain **stable** — the model "sees" essentially the same thing |
| **Adversarial image** | Internal features change **dramatically** — the perturbation is disrupted |

**Why?** Adversarial perturbations are carefully optimized to sit on the decision boundary. They are mathematically precise — even a tiny disruption pushes the internal representations into a completely different region of feature space.

Think of it like a house of cards vs. a brick wall:
- A **brick wall** (clean image) survives a gentle wind (transformation)
- A **house of cards** (adversarial image) collapses from the same gentle wind

We **measure** this instability by comparing the internal feature representations of the original and transformed images across multiple layers of a Vision Transformer.

---

## 3. System Architecture

### Two-Model Design

We use **two separate models** for a realistic experimental setting:

```
┌─────────────────────────────────────────────────────────┐
│                    TWO-MODEL ARCHITECTURE               │
├──────────────────────┬──────────────────────────────────┤
│   ATTACK MODEL       │   DETECTION MODEL                │
│   ResNet-18 (CNN)    │   ViT-B/16 (Transformer)         │
│                      │                                   │
│   - Generates        │   - Extracts intermediate         │
│     adversarial      │     features using forward hooks  │
│     examples via     │   - Computes feature consistency  │
│     FGSM and PGD     │     scores across layers          │
│   - White-box        │   - Never attacked or modified    │
│     attack target    │                                   │
└──────────────────────┴──────────────────────────────────┘
```

**Why two models?** In the real world, an attacker crafts adversarial examples against the model they have access to (e.g., a CNN). The defender deploys a *different* model (ViT) for detection. This is called a **transfer attack** scenario — the adversarial perturbations transfer across architectures, and our detector can still identify them.

### Full Pipeline

```
Input Image x
      │
      ├──────────────────────────────────────┐
      │                                      │
      ▼                                      ▼
  Apply Transform T(x)                  Original x
  (blur / noise / rotation)                  │
      │                                      │
      ▼                                      ▼
  ViT Forward Pass                    ViT Forward Pass
      │                                      │
      ▼                                      ▼
  Extract features at                Extract features at
  layers [3, 6, 9, 11]             layers [3, 6, 9, 11]
      │                                      │
      └──────────────┬───────────────────────┘
                     │
                     ▼
          Compute distances (L2, Cosine)
          between original and transformed
          features at each layer
                     │
                     ▼
          24-dimensional score vector
                     │
                     ▼
          Meta-classifier (ML model)
                     │
                     ▼
          "CLEAN" or "ADVERSARIAL"
```

---

## 4. Stage 1 — Benign Transformations

**File:** `utils/transforms.py`

**Purpose:** Apply small, harmless transformations that preserve the semantic content of clean images but disrupt adversarial perturbations.

### Why These Specific Transforms?

| Transform | Intuition | Effect on Adversarial Perturbations |
|-----------|-----------|--------------------------------------|
| **Gaussian Blur** | Smooths out high-frequency noise | Adversarial perturbations are high-frequency; blur destroys them |
| **Gaussian Noise** | Adds random noise | Randomly shifts pixel values, disrupting the precise perturbation |
| **Rotation** | Geometric transform | Spatially displaces the perturbation from its optimized position |

### Code

```python
import torch
import torchvision.transforms.functional as TF


def apply_gaussian_blur(image_tensor, kernel_size=3, sigma=0.5):
    """
    Apply Gaussian blur to smooth out high-frequency perturbations.
    
    - kernel_size=3: small kernel to keep the blur subtle
    - sigma=0.5: low standard deviation for gentle smoothing
    """
    if image_tensor.dim() == 3:
        return TF.gaussian_blur(image_tensor.unsqueeze(0), kernel_size, [sigma]).squeeze(0)
    return TF.gaussian_blur(image_tensor, kernel_size, [sigma])


def apply_gaussian_noise(image_tensor, sigma=0.02):
    """
    Add small random Gaussian noise.
    
    - sigma=0.02: very small noise level (2% of pixel range)
    - This is enough to disrupt adversarial perturbations
      but not enough to change a clean image's meaning
    """
    noise = torch.randn_like(image_tensor) * sigma
    return torch.clamp(image_tensor + noise, 0.0, 1.0)


def apply_rotation(image_tensor, angle=5.0):
    """
    Apply a fixed 5-degree rotation.
    
    - 5 degrees is imperceptible to humans
    - But spatially shifts adversarial perturbations
    """
    if image_tensor.dim() == 3:
        return TF.rotate(image_tensor.unsqueeze(0), angle).squeeze(0)
    return TF.rotate(image_tensor, angle)


def get_transforms():
    """Returns all three transforms as a dictionary of callables."""
    return {
        "blur": lambda x: apply_gaussian_blur(x, kernel_size=3, sigma=0.5),
        "noise": lambda x: apply_gaussian_noise(x, sigma=0.02),
        "rotation": lambda x: apply_rotation(x, angle=5.0),
    }
```

**Key Design Choice:** The parameters (kernel_size=3, sigma=0.02, angle=5°) are intentionally **very small**. We want transforms that are:
- ✅ Strong enough to disrupt adversarial perturbations
- ✅ Weak enough to leave clean image features mostly unchanged
- This asymmetry is what makes detection possible

---

## 5. Stage 2 — Model Loading

### Detection Model: ViT-B/16

**File:** `models/vit_loader.py`

The Vision Transformer (ViT-B/16) is our feature extraction engine. We use it as a "probe" — examining how internal representations change under transformations.

**ViT-B/16 Architecture:**
- 12 transformer blocks (layers)
- 768-dimensional embeddings
- Input: 224×224 image → 196 patches (16×16 each) + 1 CLS token = 197 tokens
- Each transformer block outputs a (197, 768) tensor

```python
import torch
import timm

def load_vit(model_name="vit_base_patch16_224", pretrained=True, 
             hook_layers=None, device=None):
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if hook_layers is None:
        hook_layers = [3, 6, 9, 11]  # Early, mid, late, final
    
    # Load pretrained ViT from timm library
    model = timm.create_model(model_name, pretrained=pretrained)
    model = model.to(device)
    model.eval()
    
    # IMPORTANT: Freeze all parameters — we never train this model
    for param in model.parameters():
        param.requires_grad = False
    
    # Register forward hooks (explained in Stage 3)
    hook_dict = {}
    hook_handles = []
    
    def make_hook(layer_idx):
        def hook_fn(module, input, output):
            hook_dict[layer_idx] = output.detach()
        return hook_fn
    
    for layer_idx in hook_layers:
        handle = model.blocks[layer_idx].register_forward_hook(make_hook(layer_idx))
        hook_handles.append(handle)
    
    return model, hook_dict, hook_handles
```

**Why layers [3, 6, 9, 11]?** We sample the network at different depths:
- **Layer 3 (early):** Low-level features like edges and textures
- **Layer 6 (mid):** Mid-level features like parts and patterns
- **Layer 9 (late):** High-level semantic features
- **Layer 11 (final):** The most abstract representation before classification

Adversarial perturbations can affect different layers differently, so monitoring multiple depths gives us a richer picture.

### Attack Model: ResNet-18

**File:** `models/resnet_loader.py`

ResNet-18 is our attack target — we craft adversarial examples against this CNN.

```python
import torch.nn as nn
from torchvision import models

def load_resnet(num_classes=10, device=None):
    # Initialize ResNet-18 (trained on CIFAR-10)
    model = models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    
    # Modify architecture for 32×32 CIFAR-10 images
    model.conv1 = nn.Conv2d(3, 64, kernel_size=3, stride=1, padding=1, bias=False)
    model.maxpool = nn.Identity()  # Remove downsampling for small images
    
    model = model.to(device)
    model.eval()
    return model
```

**Key Modification:** Standard ResNet-18 uses a 7×7 conv with stride 2 + maxpool, designed for 224×224 ImageNet images. For 32×32 CIFAR-10 images, this would aggressively downsample and lose information. We replace:
- `conv1`: 7×7/stride-2 → **3×3/stride-1** (preserves spatial resolution)
- `maxpool`: removed entirely (replaced with `nn.Identity()`)

---

## 6. Stage 3 — Feature Extraction with Forward Hooks

**File:** `features/feature_extractor.py`

### What Are Forward Hooks?

Forward hooks are PyTorch's mechanism to **intercept intermediate outputs** of a neural network during a forward pass — without modifying the network.

```
Input Image
    │
    ▼
[Block 0] ─── output captured? No
    │
[Block 1] ─── output captured? No
    │
[Block 2] ─── output captured? No
    │
[Block 3] ─── output captured? YES → hook_dict[3] = tensor
    │
    ...
    │
[Block 6] ─── output captured? YES → hook_dict[6] = tensor
    │
    ...
    │
[Block 9] ─── output captured? YES → hook_dict[9] = tensor
    │
[Block 10]
    │
[Block 11] ── output captured? YES → hook_dict[11] = tensor
    │
    ▼
Final Output (we don't use this)
```

### How Hooks Work

```python
def make_hook(layer_idx):
    """Create a closure that captures output from a specific layer."""
    def hook_fn(module, input, output):
        # 'output' is the tensor produced by this transformer block
        # Shape: (batch_size, 197, 768)
        #         ─────────  ───  ───
        #         batch      │     │
        #                    │     └─ embedding dimension
        #                    └─ 196 patch tokens + 1 CLS token
        hook_dict[layer_idx] = output.detach()
    return hook_fn

# Register: "when block 3 finishes, call my hook function"
model.blocks[3].register_forward_hook(make_hook(3))
```

### CLS Token Extraction

We use only the **CLS token** (index 0) from each layer's output:

```python
def extract_cls_features(model, image_tensor, hook_dict, device=None):
    """Extract the CLS token from each hooked layer."""
    # Preprocess: resize to 224×224, normalize with ImageNet stats
    preprocess = get_vit_preprocess()
    processed = preprocess(image_tensor.unsqueeze(0).to(device))
    
    # Forward pass — hooks automatically capture intermediate outputs
    hook_dict.clear()
    with torch.no_grad():
        _ = model(processed)
    
    # Extract CLS token (first token) from each layer
    cls_features = {}
    for layer_idx, feat in hook_dict.items():
        # feat shape: (1, 197, 768) → CLS token: (1, 768)
        cls_features[layer_idx] = feat[:, 0, :]
    
    return cls_features
```

**Why the CLS token?** The CLS (classification) token is a special token that aggregates information from all patches. It serves as the global representation of the entire image. Using it gives us a single 768-dimensional vector per layer that summarizes the image, which is ideal for distance computation.

---

## 7. Stage 4 — Feature Distance Computation

**File:** `features/feature_distance.py`

### Two Distance Metrics

We measure how much the features change using two complementary metrics:

#### L2 Distance (Euclidean)

Measures the **magnitude** of change in feature space:

```python
def compute_l2_distance(feat_a, feat_b):
    """
    L2 distance = sqrt(sum((a_i - b_i)²))
    
    - Large value → features changed a lot (suspicious!)
    - Small value → features are stable (likely clean)
    """
    return torch.norm(feat_a - feat_b, p=2).item()
```

#### Cosine Distance

Measures the **directional** change in feature space:

```python
import torch.nn.functional as F

def compute_cosine_distance(feat_a, feat_b):
    """
    Cosine distance = 1 - cosine_similarity
    
    - 0: identical direction (stable features)
    - 1: perpendicular (very different features)
    - 2: opposite direction (completely different)
    """
    cos_sim = F.cosine_similarity(feat_a, feat_b, dim=1)
    return (1.0 - cos_sim).item()
```

**Why both metrics?**
- **L2** captures absolute magnitude changes — "how far did the features move?"
- **Cosine** captures directional changes — "did the features point in a different direction?"
- Together, they provide a richer description of feature instability

### Building the 24-Dimensional Score Vector

For **each image**, we compute distances across all combinations:

```
3 transforms × 4 layers × 2 metrics = 24 features
```

```python
def compute_score_vector(model, image_tensor, hook_dict, 
                         transforms_dict=None, hook_layers=None):
    # Step 1: Extract features for the ORIGINAL image
    original_features = extract_cls_features(model, image_tensor, hook_dict)
    
    score_vector = []
    
    # Step 2: For each transform (blur, noise, rotation)
    for t_name in ["blur", "noise", "rotation"]:
        transform_fn = transforms_dict[t_name]
        
        # Apply the benign transformation
        transformed_image = transform_fn(image_tensor)
        
        # Extract features for the TRANSFORMED image
        transformed_features = extract_cls_features(
            model, transformed_image, hook_dict
        )
        
        # Step 3: Compute L2 distances at each layer
        for layer_idx in hook_layers:  # [3, 6, 9, 11]
            l2_dist = compute_l2_distance(
                original_features[layer_idx], 
                transformed_features[layer_idx]
            )
            score_vector.append(l2_dist)
        
        # Step 4: Compute cosine distances at each layer
        for layer_idx in hook_layers:
            cos_dist = compute_cosine_distance(
                original_features[layer_idx], 
                transformed_features[layer_idx]
            )
            score_vector.append(cos_dist)
    
    return score_vector  # 24 float values
```

### Score Vector Layout

```
Index  Feature Name          What It Measures
─────  ────────────          ────────────────
 0     blur_L3_L2            L2 distance at layer 3 after blur
 1     blur_L6_L2            L2 distance at layer 6 after blur
 2     blur_L9_L2            L2 distance at layer 9 after blur
 3     blur_L11_L2           L2 distance at layer 11 after blur
 4     blur_L3_cos           Cosine distance at layer 3 after blur
 5     blur_L6_cos           Cosine distance at layer 6 after blur
 6     blur_L9_cos           Cosine distance at layer 9 after blur
 7     blur_L11_cos          Cosine distance at layer 11 after blur
 8     noise_L3_L2           L2 distance at layer 3 after noise
 9     noise_L6_L2           L2 distance at layer 6 after noise
10     noise_L9_L2           L2 distance at layer 9 after noise
11     noise_L11_L2          L2 distance at layer 11 after noise
12     noise_L3_cos          Cosine distance at layer 3 after noise
13     noise_L6_cos          Cosine distance at layer 6 after noise
14     noise_L9_cos          Cosine distance at layer 9 after noise
15     noise_L11_cos         Cosine distance at layer 11 after noise
16     rot_L3_L2             L2 distance at layer 3 after rotation
17     rot_L6_L2             L2 distance at layer 6 after rotation
18     rot_L9_L2             L2 distance at layer 9 after rotation
19     rot_L11_L2            L2 distance at layer 11 after rotation
20     rot_L3_cos            Cosine distance at layer 3 after rotation
21     rot_L6_cos            Cosine distance at layer 6 after rotation
22     rot_L9_cos            Cosine distance at layer 9 after rotation
23     rot_L11_cos           Cosine distance at layer 11 after rotation
```

---

## 8. Stage 5 — Adversarial Attack Generation

### The Attack Philosophy

We generate adversarial examples using **gradient-based attacks** on ResNet-18. The idea: 

> Compute how each pixel contributes to the model's loss, then nudge pixels in the direction that **maximizes** the loss.

### FGSM — Fast Gradient Sign Method

**File:** `attacks/fgsm.py`

FGSM is a **single-step** attack. Fast but effective.

**Mathematical Formula:**

```
x_adv = x + ε · sign(∇ₓ L(θ, x, y))
```

Where:
- `x` = original clean image
- `ε` = perturbation budget (8/255 ≈ 0.031 — invisible to humans)
- `∇ₓ L` = gradient of the loss with respect to the input image
- `sign()` = takes the sign (-1, 0, or +1) of each gradient value

**Intuition:** We ask "which direction should I push each pixel to make the model MORE wrong?" — then push ALL pixels by exactly ε in that direction.

```python
def fgsm_attack(model, image, label, epsilon=8/255):
    """Generate FGSM adversarial example."""
    model.eval()
    device = next(model.parameters()).device
    
    image = image.clone().unsqueeze(0).to(device)
    label = torch.tensor([label]).to(device)
    
    # CRITICAL: Enable gradient computation on the INPUT image
    # (normally only model parameters have gradients)
    image.requires_grad = True
    
    # Forward pass: compute predictions
    output = model(image)
    
    # Compute loss: how wrong is the model?
    loss = nn.CrossEntropyLoss()(output, label)
    
    # Backward pass: compute ∂L/∂x (how each pixel affects the loss)
    model.zero_grad()
    loss.backward()
    
    # The attack: push each pixel in the direction that INCREASES loss
    grad_sign = image.grad.data.sign()    # -1, 0, or +1 for each pixel
    adv_image = image.data + epsilon * grad_sign  # Perturb by ε
    
    # Keep pixel values valid
    adv_image = torch.clamp(adv_image, 0.0, 1.0)
    
    return adv_image.squeeze(0).detach()
```

### PGD — Projected Gradient Descent

**File:** `attacks/pgd.py`

PGD is an **iterative** extension of FGSM. It takes multiple smaller steps and is considered one of the strongest first-order attacks.

**Intuition:** Instead of one big jump (FGSM), take many small careful steps, each time recalculating the best direction. Like a GPS that recalculates your route every few meters vs. giving you one initial direction.

```python
def pgd_attack(model, image, label, epsilon=8/255, alpha=2/255, steps=7):
    """Generate PGD adversarial example."""
    model.eval()
    device = next(model.parameters()).device
    
    image = image.clone().unsqueeze(0).to(device)
    label = torch.tensor([label]).to(device)
    
    # Start from a random point within the ε-ball
    adv_image = image.clone()
    random_noise = torch.empty_like(adv_image).uniform_(-epsilon, epsilon)
    adv_image = torch.clamp(adv_image + random_noise, 0.0, 1.0)
    
    # Take 'steps' gradient ascent steps
    for _ in range(steps):
        adv_image.requires_grad = True
        
        output = model(adv_image)
        loss = nn.CrossEntropyLoss()(output, label)
        
        model.zero_grad()
        loss.backward()
        
        # Small step in the gradient direction
        # α = 2/255 per step (much smaller than FGSM's ε = 8/255)
        grad_sign = adv_image.grad.data.sign()
        adv_image = adv_image.data + alpha * grad_sign
        
        # PROJECT back into ε-ball: ensure total perturbation ≤ ε
        perturbation = torch.clamp(adv_image - image, -epsilon, epsilon)
        adv_image = torch.clamp(image + perturbation, 0.0, 1.0)
    
    return adv_image.squeeze(0).detach()
```

**Key Differences: FGSM vs PGD**

| Aspect | FGSM | PGD |
|--------|------|-----|
| Steps | 1 | Multiple (7) |
| Step size | ε = 8/255 | α = 2/255 per step |
| Strength | Moderate | Strong |
| Speed | Very fast | Slower |
| Random init | No | Yes (within ε-ball) |

**Why is PGD stronger?** FGSM might "overshoot" by taking one large step. PGD iteratively refines the perturbation, finding more effective adversarial directions. It also starts from a random point, helping escape local minima.

---

## 9. Stage 6 — Score Dataset Construction

**File:** `dataset/build_score_dataset.py`

This stage combines everything to build the training dataset for our meta-classifier.

### Pipeline

```
CIFAR-10 Test Set (1,000 images, 100 per class)
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
     Clean        FGSM        PGD
     Image     Adversarial  Adversarial
        │           │           │
        ▼           ▼           ▼
   Score Vector  Score Vector  Score Vector
   (24-dim)     (24-dim)     (24-dim)
   label = 0    label = 1    label = 1
        │           │           │
        └───────────┼───────────┘
                    │
                    ▼
            score_dataset.npz
            X: (3000, 24)
            y: (3000,)
```

### Code Walkthrough

```python
def build_score_dataset(num_images=1000, save_path=None, device=None):
    # Load both models
    vit_model, hook_dict, hook_handles = load_vit(device=device)    # Detection
    resnet_model = load_resnet(device=device)                        # Attack
    
    # Load CIFAR-10 test set
    test_dataset = datasets.CIFAR10(root="./data", train=False, 
                                     download=True, transform=transforms.ToTensor())
    
    # Select balanced subset (100 images per class)
    selected_indices = select_balanced_subset(test_dataset, num_images)
    
    all_scores = []
    all_labels = []
    
    for idx in tqdm(selected_indices, desc="Processing images"):
        image, label = test_dataset[idx]
        image = image.to(device)
        
        # 1. Clean image → score vector → label = 0
        clean_score = compute_score_vector(vit_model, image, hook_dict)
        all_scores.append(clean_score)
        all_labels.append(0)  # CLEAN
        
        # 2. FGSM adversarial → score vector → label = 1
        adv_fgsm = fgsm_attack(resnet_model, image, label)
        fgsm_score = compute_score_vector(vit_model, adv_fgsm, hook_dict)
        all_scores.append(fgsm_score)
        all_labels.append(1)  # ADVERSARIAL
        
        # 3. PGD adversarial → score vector → label = 1
        adv_pgd = pgd_attack(resnet_model, image, label)
        pgd_score = compute_score_vector(vit_model, adv_pgd, hook_dict)
        all_scores.append(pgd_score)
        all_labels.append(1)  # ADVERSARIAL
    
    # Save as numpy arrays
    X = np.array(all_scores, dtype=np.float32)  # (3000, 24)
    y = np.array(all_labels, dtype=np.int32)     # (3000,)
    np.savez(save_path, X=X, y=y)
```

**Dataset Statistics:**
- 1,000 clean images → 1,000 clean score vectors (label 0)
- 1,000 FGSM adversarial images → 1,000 adversarial score vectors (label 1)
- 1,000 PGD adversarial images → 1,000 adversarial score vectors (label 1)
- **Total: 3,000 samples × 24 features**
- **Class balance: 1:2 (clean:adversarial)**

---

## 10. Stage 7 — Meta-Classifier Training

**File:** `meta_model/train_classifier.py`

### What is a Meta-Classifier?

The meta-classifier is a **second-level model** that operates on extracted features rather than raw images. It takes the 24-dimensional score vector and predicts:
- **0 → CLEAN IMAGE**
- **1 → ADVERSARIAL IMAGE**

### Four Models Compared

| Model | How It Works | Strengths |
|-------|-------------|-----------|
| **Logistic Regression** | Linear decision boundary | Simple baseline, interpretable |
| **Random Forest** | Ensemble of decision trees | Handles non-linear patterns, robust |
| **Gradient Boosting** | Sequential boosted trees | Often best accuracy, captures interactions |
| **MLP** | Small neural network (24→64→32→1) | Learns complex non-linear boundaries |

### Training Pipeline

```python
def train_classifier(dataset_path=None):
    # Load dataset
    data = np.load(dataset_path)
    X, y = data["X"], data["y"]
    
    # 80/20 stratified split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y  # Preserve class ratios
    )
    
    # IMPORTANT: Standardize features (zero mean, unit variance)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train and evaluate each model
    models = {
        "Logistic Regression": LogisticRegression(max_iter=1000),
        "Random Forest": RandomForestClassifier(n_estimators=100),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=100),
        "MLP": MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=500),
    }
    
    for name, model in models.items():
        model.fit(X_train_scaled, y_train)
        y_pred = model.predict(X_test_scaled)
        y_prob = model.predict_proba(X_test_scaled)[:, 1]
        
        # Compute metrics
        print(f"Accuracy:  {accuracy_score(y_test, y_pred):.4f}")
        print(f"Precision: {precision_score(y_test, y_pred):.4f}")
        print(f"Recall:    {recall_score(y_test, y_pred):.4f}")
        print(f"F1:        {f1_score(y_test, y_pred):.4f}")
        print(f"ROC-AUC:   {roc_auc_score(y_test, y_prob):.4f}")
    
    # Save best model (highest ROC-AUC)
    joblib.dump(best_model, "outputs/best_meta_model.pkl")
    joblib.dump(scaler, "outputs/scaler.pkl")  # Need scaler for inference!
```

### Evaluation Metrics Explained

| Metric | Formula | What It Tells Us |
|--------|---------|-----------------|
| **Accuracy** | Correct / Total | Overall correctness |
| **Precision** | TP / (TP + FP) | "Of images flagged adversarial, how many truly were?" |
| **Recall** | TP / (TP + FN) | "Of all adversarial images, how many did we catch?" |
| **F1 Score** | 2 × (Prec × Rec) / (Prec + Rec) | Harmonic mean — balances precision and recall |
| **ROC-AUC** | Area under ROC curve | Overall discrimination ability (1.0 = perfect) |

**Why StandardScaler?** The 24 features have different scales — L2 distances might range from 0 to 100, while cosine distances range from 0 to 2. Without scaling, models like Logistic Regression would be biased toward high-magnitude features.

### ROC Curve

The ROC (Receiver Operating Characteristic) curve plots True Positive Rate vs. False Positive Rate at different classification thresholds. The plot is saved to `outputs/roc_curves.png`, showing all four models compared.

---

## 11. Stage 8 — Inference Pipeline

**File:** `meta_model/inference_classifier.py`

### The AdversarialDetector Class

```python
class AdversarialDetector:
    def __init__(self):
        # Load trained meta-classifier
        self.classifier = joblib.load("outputs/best_meta_model.pkl")
        
        # Load feature scaler (same one used during training)
        self.scaler = joblib.load("outputs/scaler.pkl")
        
        # Load ViT detection model with hooks
        self.vit_model, self.hook_dict, self.hook_handles = load_vit()
    
    def predict(self, image_tensor):
        """
        Full detection pipeline for a single image:
        
        image → [apply 3 transforms] → [extract ViT features]
              → [compute 24 distances] → [scale] → [classify]
              → "CLEAN" or "ADVERSARIAL"
        """
        # Step 1: Compute 24-dim score vector
        score_vector = compute_score_vector(
            self.vit_model, image_tensor, self.hook_dict
        )
        
        # Step 2: Scale using the same scaler from training
        score_scaled = self.scaler.transform([score_vector])
        
        # Step 3: Predict
        prediction = self.classifier.predict(score_scaled)[0]
        confidence = self.classifier.predict_proba(score_scaled)[0]
        
        return {
            "label": "ADVERSARIAL IMAGE" if prediction == 1 else "CLEAN IMAGE",
            "confidence": float(confidence[prediction]),
            "probabilities": {
                "clean": float(confidence[0]),
                "adversarial": float(confidence[1]),
            }
        }
```

---

## 12. Why This Works — Deep Intuition

### The Fundamental Asymmetry

```
CLEAN IMAGE                          ADVERSARIAL IMAGE
───────────                          ─────────────────

Lives in a STABLE region             Lives on a DECISION BOUNDARY
of feature space                     (razor-thin edge)

     Feature Space                        Feature Space
    ┌──────────────┐                     ┌──────────────┐
    │    ╭───╮     │                     │              │
    │   │ x │     │                     │        x ← on the edge
    │    ╰───╯     │                     │────────┼─────│
    │  safe zone   │                     │ class A│cl.B │
    └──────────────┘                     └────────┴─────┘

Small transform T(x):                Small transform T(x):
x stays in the same zone             x falls across the boundary
→ features barely change              → features change drastically

Score vector: [0.1, 0.05, ...]       Score vector: [5.2, 3.8, ...]
(small distances)                     (large distances)
```

### Why Multiple Transforms Help

Using three transforms instead of one is like checking a lock from three angles:
- **Blur** catches perturbations that rely on high-frequency patterns
- **Noise** catches perturbations that are sensitive to any pixel-level changes
- **Rotation** catches perturbations that depend on exact spatial positioning

Some adversarial examples might survive one transform but rarely survive all three.

### Why Multiple Layers Help

Different layers capture different levels of instability:
- **Early layers** show disruption in low-level visual patterns
- **Deep layers** show disruption in semantic understanding
- An adversarial image might fool deep layers while early layers remain stable, or vice versa

By monitoring 4 layers × 3 transforms × 2 metrics, we get a comprehensive 24-dimensional "fingerprint" of feature stability.

---

## 13. Running the Project

### Prerequisites

```bash
pip install -r requirements.txt
```

### Complete Pipeline (4 Steps)

```bash
# Step 1: Fine-tune ResNet-18 on CIFAR-10 (attack model)
# This trains the CNN that adversarial examples will be crafted against
python main.py finetune-resnet

# Step 2: Build the score vector dataset
# Generates clean and adversarial images, extracts ViT features,
# computes 24-dim score vectors, saves to outputs/score_dataset.npz
python main.py build-dataset

# Step 3: Train meta-classifiers
# Trains 4 models, evaluates all metrics, saves best model
python main.py train

# Step 4: Run demo on sample images
# Tests the full pipeline on random CIFAR-10 images
python main.py demo
```

```bash
# Full CIFAR-100 pipeline:
python main.py finetune-resnet --dataset cifar100    # Step 1 (100 classes)
python main.py build-dataset --dataset cifar100      # Step 2
python main.py train                                 # Step 3 (same)
python main.py demo --dataset cifar100               # Step 4
````

### Quick Test (Small Subset)

```bash
python main.py build-dataset --num-images 10  # Only 10 images → 30 samples
python main.py train                           # Train on small dataset
python main.py demo                            # Test
```

### Detect a Specific Image

```bash
python main.py infer --image path/to/suspicious_image.png
```

### Project Structure

```
project/
├── models/
│    ├── vit_loader.py           # ViT-B/16 (detection model)
│    └── resnet_loader.py        # ResNet-18 (attack model)
├── attacks/
│    ├── fgsm.py                 # FGSM attack on ResNet-18
│    └── pgd.py                  # PGD attack on ResNet-18
├── features/
│    ├── feature_extractor.py    # ViT forward hooks + CLS extraction
│    └── feature_distance.py     # L2 + cosine → 24-dim score vector
├── dataset/
│    └── build_score_dataset.py  # Build (3000, 24) dataset
├── meta_model/
│    ├── train_classifier.py     # Train 4 classifiers
│    └── inference_classifier.py # AdversarialDetector class
├── utils/
│    └── transforms.py           # Blur, noise, rotation
├── main.py                      # CLI entry point
└── requirements.txt             # Dependencies
```

---

*This project demonstrates that adversarial perturbations, while invisible to the human eye, leave detectable "fingerprints" in the internal representations of Vision Transformers — and that simple classical ML models can learn to read these fingerprints.*
