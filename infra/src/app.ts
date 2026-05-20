import { App } from "aws-cdk-lib";
import { createInfrastructure } from "./infra-app.js";

const app = new App();

createInfrastructure(app);
