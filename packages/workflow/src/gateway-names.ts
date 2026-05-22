const gatewayToolDelimiter = "___";

export function normalizeGatewayToolName(toolName: string): string {
  const delimiterIndex = toolName.lastIndexOf(gatewayToolDelimiter);
  if (delimiterIndex < 0) {
    return toolName;
  }

  return toolName.slice(delimiterIndex + gatewayToolDelimiter.length);
}
