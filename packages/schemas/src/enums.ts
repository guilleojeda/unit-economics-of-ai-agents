import { z } from "zod";

export const WorkflowVariant = [
  "V1_TEXT_ONLY",
  "V2_TEXT_AND_IMAGE_ANNOTATION",
  "V3_OPTIMIZED"
] as const;
export const WorkflowVariantSchema = z.enum(WorkflowVariant);
export type WorkflowVariant = z.infer<typeof WorkflowVariantSchema>;

export const DocumentStatus = [
  "UPLOADED",
  "INSPECTING",
  "READY",
  "UNSUPPORTED",
  "FAILED_INSPECTION"
] as const;
export const DocumentStatusSchema = z.enum(DocumentStatus);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const JobStatus = [
  "CREATED",
  "RUNNING",
  "AWAITING_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "ESCALATED",
  "FAILED"
] as const;
export const JobStatusSchema = z.enum(JobStatus);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const RunStatus = [
  "CREATED",
  "QUEUED",
  "RUNNING",
  "EVALUATING",
  "AWAITING_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "ESCALATED",
  "FAILED"
] as const;
export const RunStatusSchema = z.enum(RunStatus);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const StageName = [
  "inspect_pdf",
  "route_document",
  "extract_text_layout",
  "extract_images",
  "selective_extract_images",
  "chunk_and_align",
  "translate_text_chunks",
  "batch_translate_text_chunks",
  "translate_image_text",
  "selective_translate_image_text",
  "recompose_pdf",
  "evaluate_translation",
  "reviewer_decision",
  "finalize_economics"
] as const;
export const StageNameSchema = z.enum(StageName);
export type StageName = z.infer<typeof StageNameSchema>;

export const StageEventStatus = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "SKIPPED"
] as const;
export const StageEventStatusSchema = z.enum(StageEventStatus);
export type StageEventStatus = z.infer<typeof StageEventStatusSchema>;

export const ArtifactType = [
  "SOURCE_PDF",
  "INSPECTION_JSON",
  "TEXT_LAYOUT_JSON",
  "IMAGE_MANIFEST_JSON",
  "IMAGE_ASSET",
  "SOURCE_CHUNKS_JSON",
  "TRANSLATED_CHUNKS_JSON",
  "IMAGE_TRANSLATION_JSON",
  "TRANSLATED_PDF",
  "PDF_PREVIEW_PNG",
  "EVALUATION_JSON",
  "LEDGER_EXPORT_JSON"
] as const;
export const ArtifactTypeSchema = z.enum(ArtifactType);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const ComponentType = [
  "MODEL_INFERENCE",
  "AGENTCORE_RUNTIME",
  "AGENTCORE_GATEWAY",
  "AGENTCORE_POLICY",
  "AGENTCORE_MEMORY",
  "EXTERNAL_SERVICE",
  "HUMAN_REVIEW",
  "RETRY",
  "REMEDIATION"
] as const;
export const ComponentTypeSchema = z.enum(ComponentType);
export type ComponentType = z.infer<typeof ComponentTypeSchema>;

export const CostSource = [
  "BEDROCK_RESPONSE_USAGE",
  "AGENTCORE_RUNTIME_METRIC",
  "AGENTCORE_GATEWAY_METRIC",
  "AGENTCORE_POLICY_METRIC",
  "AGENTCORE_MEMORY_METRIC",
  "EXTERNAL_SERVICE_METRIC",
  "HUMAN_REVIEW_TIMER",
  "PRICE_BOOK_ESTIMATE",
  "AWS_BILL_RECONCILED"
] as const;
export const CostSourceSchema = z.enum(CostSource);
export type CostSource = z.infer<typeof CostSourceSchema>;

export const BillableUnit = [
  "INPUT_TOKEN",
  "OUTPUT_TOKEN",
  "TOOL_OPERATION",
  "AUTHORIZATION_REQUEST",
  "VCPU_HOUR",
  "GB_HOUR",
  "MEMORY_EVENT",
  "SECOND",
  "DOCUMENT",
  "PAGE",
  "IMAGE"
] as const;
export const BillableUnitSchema = z.enum(BillableUnit);
export type BillableUnit = z.infer<typeof BillableUnitSchema>;

export const CostBasis = [
  "TELEMETRY_DERIVED_PRICE_BOOK_ESTIMATE",
  "AWS_BILL_RECONCILED",
  "MIXED"
] as const;
export const CostBasisSchema = z.enum(CostBasis);
export type CostBasis = z.infer<typeof CostBasisSchema>;

export const ReviewDecisionValue = [
  "ACCEPTED",
  "REJECTED",
  "ESCALATED"
] as const;
export const ReviewDecisionValueSchema = z.enum(ReviewDecisionValue);
export type ReviewDecisionValue = z.infer<typeof ReviewDecisionValueSchema>;

export const PriceBookStatus = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export const PriceBookStatusSchema = z.enum(PriceBookStatus);
export type PriceBookStatus = z.infer<typeof PriceBookStatusSchema>;

export const ToolStatus = ["SUCCEEDED", "FAILED"] as const;
export const ToolStatusSchema = z.enum(ToolStatus);
export type ToolStatus = z.infer<typeof ToolStatusSchema>;
