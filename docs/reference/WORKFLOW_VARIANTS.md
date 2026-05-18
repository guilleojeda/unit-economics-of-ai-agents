# Workflow Variants Reference

## V1_TEXT_ONLY

```text
inspect_pdf
extract_text_layout
chunk_and_align
translate_text_chunks
recompose_pdf
evaluate_translation
finalize_economics
```

Meaning:

```text
Baseline path.
Translates extractable PDF text.
Leaves embedded image text untranslated.
May still be acceptable if image text is non-material.
```

## V2_TEXT_AND_IMAGE_ANNOTATION

```text
inspect_pdf
extract_text_layout
extract_images
chunk_and_align
translate_text_chunks
translate_image_text
recompose_pdf
evaluate_translation
finalize_economics
```

Meaning:

```text
Adds image-text translation by annotation, callout, caption, or overlay.
Demonstrates added capability and added cost.
No full image inpainting.
```

## V3_OPTIMIZED

```text
inspect_pdf
route_document
extract_text_layout
selective_extract_images
chunk_and_align
batch_translate_text_chunks
selective_translate_image_text
recompose_pdf
evaluate_translation
finalize_economics
```

Meaning:

```text
Architectural optimization.
Routes selectively.
Processes only material image text.
Skips decorative/low-materiality work.
Shows architecture-driven margin change.
```
