# LeafMind Medicinal Leaf Images Dataset

## Purpose
Image dataset of medicinal plant leaves for species classification, built for use with PyTorch ImageFolder, torchvision, HuggingFace Datasets, and OpenCLIP/CLIP fine-tuning workflows.

## Number of Classes
37 (36 with approved scientific-name training labels, 5 pending manual taxonomy verification and copied under their original folder name)

## Number of Images
1,932 (all `.jpg`, copied unmodified — no resizing, recompression, or format changes)

## Folder Structure
```
datasets/
    raw/
        medicinal_leaf_images/
            <ClassName>/
                *.jpg
    processed/      (reserved for future preprocessing outputs)
    splits/         (reserved for future train/val/test splits)
    metadata/
        classes.json
        labels.json
        dataset_statistics.json
        dataset_version.json
    README.md
```

## Naming Convention
- Approved classes: `Genus_species` (underscores, standardized capitalization), derived from the approved taxonomy implementation plan.
- Classes without a confirmed scientific name (`Requires Manual Verification` status) retain their original source folder name unchanged, and are excluded from automatic renaming until taxonomy is resolved.
- One duplicate folder pair (`Putranjiva roxburghii` / `Putranjiva roxburghii (1)`) was merged into a single `Putranjiva_roxburghii` class; colliding filenames from the secondary folder were prefixed with `dup_` to avoid overwriting.
- Three confirmed-empty folders were excluded from this dataset build.

## Version
3.0.0 — 2026-07-13

Source: `PilikulaDataset_Resized` (master copy, left unmodified).
