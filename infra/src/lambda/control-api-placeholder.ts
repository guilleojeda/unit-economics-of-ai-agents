export const controlApiPlaceholderSource = `
const body = JSON.stringify({
  error: {
    code: "NOT_IMPLEMENTED",
    message: "Persistent Control API behavior is deferred until PR-009",
    details: {
      deferredUntil: "PR-009"
    }
  }
});

exports.handler = async function handler() {
  return {
    statusCode: 501,
    headers: {
      "content-type": "application/json"
    },
    body
  };
};
`;
