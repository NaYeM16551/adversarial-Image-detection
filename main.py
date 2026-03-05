import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"  # Fix OpenMP conflict on Windows/conda

"""
Adversarial Image Detection via Feature Consistency in Vision Transformers
==========================================================================

Main entry point with CLI subcommands:
    python main.py finetune-resnet   # Fine-tune ResNet-18 on CIFAR-10
    python main.py build-dataset     # Build feature consistency score dataset
    python main.py train             # Train meta-classifiers
    python main.py infer <image>     # Detect single image
    python main.py demo              # Run demo on sample images

Two-Model Architecture:
    Attack model:     ResNet-18 (CNN) — generates adversarial examples
    Detection model:  ViT-B/16 (Vision Transformer) — extracts features
"""

import argparse
import sys
import os
import torch
import numpy as np


def cmd_finetune_resnet(args):
    """Fine-tune ResNet-18 on the specified dataset (cifar10 or cifar100)."""
    try:
        from models.resnet_loader import finetune_resnet
    except ImportError as e:
        print(f"[ERROR] Failed to import resnet_loader: {e}")
        sys.exit(1)
    
    # Ensure outputs directory exists
    os.makedirs("outputs", exist_ok=True)
    
    dataset = args.dataset.lower()
    num_classes = 100 if dataset == "cifar100" else 10
    save_path = os.path.join("outputs", f"resnet18_{dataset}.pth")
    
    print(f"[Fine-Tuning] Dataset: {dataset.upper()} ({num_classes} classes)")
    finetune_resnet(
        num_epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        num_classes=num_classes,
        save_path=save_path,
        dataset_name=dataset,
    )


def cmd_build_dataset(args):
    """Build feature consistency score dataset."""
    try:
        from dataset.build_score_dataset import build_score_dataset
    except ImportError as e:
        print(f"[ERROR] Failed to import build_score_dataset: {e}")
        sys.exit(1)
    
    # Ensure outputs directory exists
    os.makedirs("outputs", exist_ok=True)
    
    dataset = args.dataset.lower()
    resnet_path = os.path.join("outputs", f"resnet18_{dataset}.pth")
    
    if not os.path.exists(resnet_path):
        print(f"[ERROR] ResNet-18 weights not found at {resnet_path}!")
        print(f"Please run: python main.py finetune-resnet --dataset {dataset}")
        sys.exit(1)
    
    X, y = build_score_dataset(
        num_images=args.num_images,
        dataset_name=dataset,
        resnet_weights_path=resnet_path,
    )
    print(f"\nDataset built successfully!")
    print(f"Shape: X={X.shape}, y={y.shape}")


def cmd_train(args):
    """Train meta-classifiers on the score dataset."""
    try:
        from meta_model.train_classifier import train_classifier
    except ImportError as e:
        print(f"[ERROR] Failed to import train_classifier: {e}")
        sys.exit(1)
    
    dataset_path = os.path.join("outputs", "score_dataset.npz")
    if not os.path.exists(dataset_path):
        print("[ERROR] Score dataset not found!")
        print("Please run: python main.py build-dataset")
        sys.exit(1)
    
    results, best_model = train_classifier(dataset_path=dataset_path)
    print(f"\nTraining complete! Best model: {best_model}")


def cmd_infer(args):
    """Run inference on a single image."""
    try:
        from meta_model.inference_classifier import AdversarialDetector
        from torchvision import transforms
        from PIL import Image
    except ImportError as e:
        print(f"[ERROR] Failed to import required modules: {e}")
        sys.exit(1)
    
    # Check if required files exist
    for f in ["outputs/best_meta_model.pkl", "outputs/scaler.pkl"]:
        if not os.path.exists(f):
            print(f"[ERROR] {f} not found!")
            print("Please run: python main.py train")
            sys.exit(1)
    
    # Check if image file exists
    if not os.path.exists(args.image):
        print(f"[ERROR] Image file {args.image} not found!")
        sys.exit(1)
    
    try:
        # Load image
        image = Image.open(args.image).convert("RGB")
        transform = transforms.ToTensor()
        image_tensor = transform(image)
        
        # Run detection
        detector = AdversarialDetector()
    except Exception as e:
        print(f"[ERROR] Failed to load image: {e}")
        sys.exit(1)
    try:
        result = detector.predict(image_tensor)
        
        print(f"\n{'=' * 50}")
        print(f" RESULT: {result['label']}")
        print(f" Confidence: {result['confidence']:.4f}")
        print(f"{'=' * 50}")
        print(f" P(clean):       {result['probabilities']['clean']:.4f}")
        print(f" P(adversarial): {result['probabilities']['adversarial']:.4f}")
        print(f"{'=' * 50}")
    finally:
        detector.cleanup()


def cmd_demo(args):
    """Run demo on sample CIFAR-10 or CIFAR-100 images (clean + adversarial)."""
    try:
        from meta_model.inference_classifier import AdversarialDetector
        from models.resnet_loader import load_resnet
        from attacks.fgsm import fgsm_attack
        from attacks.pgd import pgd_attack
        from torchvision import datasets, transforms
    except ImportError as e:
        print(f"[ERROR] Failed to import required modules: {e}")
        sys.exit(1)
    
    # Check if required files exist
    for f in ["outputs/best_meta_model.pkl", "outputs/scaler.pkl"]:
        if not os.path.exists(f):
            print(f"[ERROR] {f} not found!")
            print("Please run: python main.py train")
            sys.exit(1)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dataset = args.dataset.lower()
    num_classes = 100 if dataset == "cifar100" else 10
    
    # Ensure data directory exists
    os.makedirs("./data", exist_ok=True)
    
    try:
        # Load the appropriate test dataset
        if dataset == "cifar100":
            test_dataset = datasets.CIFAR100(
                root="./data", train=False, download=True,
                transform=transforms.ToTensor()
            )
        else:
            test_dataset = datasets.CIFAR10(
                root="./data", train=False, download=True,
                transform=transforms.ToTensor()
            )
        
        class_names = test_dataset.classes
        
        # Load detector
        detector = AdversarialDetector(device=device)
        
        # Load ResNet-18 for generating adversarial examples
        resnet_weights = os.path.join("outputs", f"resnet18_{dataset}.pth")
        resnet_model = load_resnet(num_classes=num_classes, weights_path=resnet_weights, device=device)
        for param in resnet_model.parameters():
            param.requires_grad = True
    except Exception as e:
        print(f"[ERROR] Failed to load models or dataset: {e}")
        sys.exit(1)
    
    print(f"\n{'=' * 60}")
    print(f" ADVERSARIAL DETECTION DEMO")
    print(f"{'=' * 60}")
    
    num_demo = min(args.num_samples, len(test_dataset)) if hasattr(args, 'num_samples') else 5
    indices = np.random.choice(len(test_dataset), num_demo, replace=False)
    
    # Detection accuracy counters (did our detector correctly label clean/adversarial?)
    correct = 0
    total = 0
    
    # Attack success counters (did the adversarial image fool ViT's own classifier?)
    vit_fooled_fgsm = 0
    vit_fooled_pgd  = 0
    
    try:
        for idx in indices:
            image, label = test_dataset[idx]
            image = image.to(device)
            true_class = class_names[label]
            
            print(f"\n{'─' * 55}")
            print(f"Image {idx:5d} | True class: {true_class}")
            
            # ── ViT's classification of the CLEAN image ──────────────────
            vit_clean_pred = detector.classify(image)
            vit_clean_name = class_names[vit_clean_pred] if vit_clean_pred < len(class_names) else f"cls_{vit_clean_pred}"
            
            # ── Detection: is this clean or adversarial? ─────────────────
            result_clean = detector.predict(image)
            is_correct_clean = result_clean["prediction"] == 0
            correct += int(is_correct_clean)
            total += 1
            status = "✓" if is_correct_clean else "✗"
            clean_match = "✓" if vit_clean_pred == label else "✗"
            print(f"  Clean:    Detected={result_clean['label']:<18s} "
                  f"(conf:{result_clean['confidence']:.3f}) [{status}]  "
                  f"ViT classifies as: {vit_clean_name} [{clean_match}]")
            
            # ── FGSM adversarial ─────────────────────────────────────────
            adv_fgsm = fgsm_attack(resnet_model, image, label)
            result_fgsm = detector.predict(adv_fgsm)
            is_correct_fgsm = result_fgsm["prediction"] == 1
            correct += int(is_correct_fgsm)
            total += 1
            status = "✓" if is_correct_fgsm else "✗"
            
            vit_fgsm_pred = detector.classify(adv_fgsm)
            vit_fgsm_name = class_names[vit_fgsm_pred] if vit_fgsm_pred < len(class_names) else f"cls_{vit_fgsm_pred}"
            fooled_fgsm   = vit_fgsm_pred != label
            vit_fooled_fgsm += int(fooled_fgsm)
            fool_tag = "FOOLED ✗" if fooled_fgsm else "not fooled ✓"
            print(f"  FGSM:     Detected={result_fgsm['label']:<18s} "
                  f"(conf:{result_fgsm['confidence']:.3f}) [{status}]  "
                  f"ViT: {true_class} → {vit_fgsm_name} [{fool_tag}]")
            
            # ── PGD adversarial ──────────────────────────────────────────
            adv_pgd = pgd_attack(resnet_model, image, label)
            result_pgd = detector.predict(adv_pgd)
            is_correct_pgd = result_pgd["prediction"] == 1
            correct += int(is_correct_pgd)
            total += 1
            status = "✓" if is_correct_pgd else "✗"
            
            vit_pgd_pred = detector.classify(adv_pgd)
            vit_pgd_name = class_names[vit_pgd_pred] if vit_pgd_pred < len(class_names) else f"cls_{vit_pgd_pred}"
            fooled_pgd   = vit_pgd_pred != label
            vit_fooled_pgd += int(fooled_pgd)
            fool_tag = "FOOLED ✗" if fooled_pgd else "not fooled ✓"
            print(f"  PGD:      Detected={result_pgd['label']:<18s} "
                  f"(conf:{result_pgd['confidence']:.3f}) [{status}]  "
                  f"ViT: {true_class} → {vit_pgd_name} [{fool_tag}]")
        
        # ── Summary ──────────────────────────────────────────────────────
        print(f"\n{'=' * 55}")
        print(f" DETECTION SUMMARY  ({num_demo} images)")
        print(f"{'=' * 55}")
        print(f"  Detector accuracy:      {correct}/{total} = {100*correct/total:.1f}%")
        print(f"  (correctly labelled clean + adversarial samples)")
        print(f"\n  ViT ATTACK SUCCESS RATE (transfer attack from ResNet-18):")
        print(f"  FGSM fooled ViT:  {vit_fooled_fgsm}/{num_demo} = {100*vit_fooled_fgsm/num_demo:.1f}%")
        print(f"  PGD  fooled ViT:  {vit_fooled_pgd}/{num_demo}  = {100*vit_fooled_pgd/num_demo:.1f}%")
        print(f"  (% of adversarial images where ViT predicted wrong class)")
        print(f"{'=' * 55}")
    except KeyboardInterrupt:
        print("\n[INFO] Demo interrupted by user")
    except Exception as e:
        print(f"\n[ERROR] Demo failed: {e}")
        import traceback; traceback.print_exc()
    finally:
        detector.cleanup()


def main():
    parser = argparse.ArgumentParser(
        description="Adversarial Image Detection via Feature Consistency in ViT",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples (CIFAR-10):
  python main.py finetune-resnet                               # Step 1
  python main.py build-dataset                                 # Step 2
  python main.py build-dataset --num-images 10                 # Quick test
  python main.py train                                         # Step 3
  python main.py demo                                          # Step 4
  python main.py infer --image photo.png                       # Detect image

Examples (CIFAR-100):
  python main.py finetune-resnet --dataset cifar100            # Step 1
  python main.py build-dataset --dataset cifar100              # Step 2
  python main.py train                                         # Step 3
  python main.py demo --dataset cifar100                       # Step 4
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # finetune-resnet
    p_finetune = subparsers.add_parser("finetune-resnet",
                                        help="Fine-tune ResNet-18 on CIFAR-10 or CIFAR-100")
    p_finetune.add_argument("--dataset", type=str, default="cifar10",
                           choices=["cifar10", "cifar100"],
                           help="Dataset to train on (default: cifar10)")
    p_finetune.add_argument("--epochs", type=int, default=25,
                           help="Number of training epochs (default: 25)")
    p_finetune.add_argument("--batch-size", type=int, default=128,
                           help="Training batch size (default: 128)")
    p_finetune.add_argument("--lr", type=float, default=0.001,
                           help="Learning rate (default: 0.001)")
    
    # build-dataset
    p_build = subparsers.add_parser("build-dataset",
                                     help="Build feature consistency score dataset")
    p_build.add_argument("--dataset", type=str, default="cifar10",
                        choices=["cifar10", "cifar100"],
                        help="Dataset to use (default: cifar10)")
    p_build.add_argument("--num-images", type=int, default=50000,
                        help="Number of clean images to use (default: 50000)")
    
    # train
    p_train = subparsers.add_parser("train", 
                                     help="Train meta-classifiers")
    
    # infer
    p_infer = subparsers.add_parser("infer", 
                                     help="Run inference on a single image")
    p_infer.add_argument("--image", type=str, required=True,
                        help="Path to image file")
    
    # demo
    p_demo = subparsers.add_parser("demo",
                                    help="Run demo on sample CIFAR-10 or CIFAR-100 images")
    p_demo.add_argument("--dataset", type=str, default="cifar10",
                       choices=["cifar10", "cifar100"],
                       help="Dataset to use (default: cifar10)")
    p_demo.add_argument("--num-samples", type=int, default=100,
                       help="Number of sample images (default: 100)")
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        sys.exit(0)
    
    # Print header
    print("╔══════════════════════════════════════════════════════════╗")
    print("║  Adversarial Detection via Feature Consistency in ViT   ║")
    print("║  Attack Model: ResNet-18 │ Detection Model: ViT-B/16   ║")
    print("╚══════════════════════════════════════════════════════════╝")
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    if device.type == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")
    print()
    
    # Dispatch to command handler
    commands = {
        "finetune-resnet": cmd_finetune_resnet,
        "build-dataset": cmd_build_dataset,
        "train": cmd_train,
        "infer": cmd_infer,
        "demo": cmd_demo,
    }
    
    commands[args.command](args)


if __name__ == "__main__":
    main()
