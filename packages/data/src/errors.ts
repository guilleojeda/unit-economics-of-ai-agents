export class RepositoryConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RepositoryConfigError";
  }
}

export class RepositoryConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RepositoryConflictError";
  }
}

export class RepositoryInvariantError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RepositoryInvariantError";
  }
}

export class RepositorySerializationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RepositorySerializationError";
  }
}
