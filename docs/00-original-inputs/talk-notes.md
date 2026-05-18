## **The Unit Economics of AI Agents**

*Who is your audience? What do they know already? What don’t they know? What do they need to know?*

**Audience:** Engineers, architects, platform leads, and technical product leaders building AI agents on AWS and trying to decide whether a workflow deserves to exist as a product.

**They know:**

* Model pricing exists  
* Agents can call tools and automate work  
* A prototype can look impressive quickly  
* AWS has services for running and observing agent systems

**They don’t know:**

* How to decide whether the *problem* is worth automating with an agent  
* How to define the right economic unit for an agentic workflow  
* How to measure the full cost of solving one business task end to end  
* How to instrument Amazon Bedrock AgentCore so the cost is measured instead of guessed

**What do they need to know:**

* Unit economics starts with the value of the problem, not the price of the model  
* The number that matters is the cost to solve one accepted business task  
* “Cost per verified outcome” is the measurement tool for the cost side  
* A real calculation has to include inference, runtime, tools, memory, review, retries, and remediation  
* AgentCore is the right platform layer to measure this on AWS

*What is your end in mind? What outcome do you want? What you want your audience to think, feel, or do after they’ve heard your message? Be specific.*

**End:** Stop treating AI cost as a model-pricing discussion and start treating it as a product-viability question.

**Think / feel / do:**

* **Think:** “The first question is not ‘which model is cheapest?’ It is ‘how much does it cost to solve this problem with an agent?’”  
* **Feel:** “I can answer that with instrumentation and a simple cost model, not guesswork.”  
* **Do:** define one business unit, instrument the agent on AgentCore, calculate the full cost to solve that unit, and compare it to either value created or manual baseline cost.

*What are the NEED TO KNOWS (3 key points) that lead to your end in mind?*

* **Unit economics starts with problem value.** A capable agent can still be a bad product if the problem it solves is not worth more than the cost of solving it.  
* **The cost is end-to-end workflow cost, not token cost.** Inference is only one component, the real number includes runtime, tool calls, memory, human review, retries, and failure remediation. And you can measure these from a POC, you don't need to guess.  
* **Architecture determines margins.** Routing, deterministic code paths, fewer handoffs, narrower tool use, and selective review change the economics and the viability of an agent.

## **CFP**

*Proposed Dev Chat title (13–70 characters WITH spaces)*  
**The Unit Economics of AI Agents**

*Proposed Dev Chat abstract/talk description (less than 100 words)*  
An AI agent is only good when the problem it solves is worth more than the cost of solving it. In this talk, I’ll explain how to calculate the Cost per Verified Outcome, and I'll show how to measure the actual costs for a real agent built on Amazon Bedrock AgentCore. We’ll trace one workflow from invocation to accepted result and account for model inference, AgentCore runtime, gateway and tool calls, memory usage, human review, retries, and failure remediation. You'll leave this talk with a practical method for deciding whether an agentic product is economically viable before you put it in production, and before you lose money.

*What AWS services will you mention in your talk?*  
 Amazon Bedrock AgentCore Runtime  
 Amazon Bedrock AgentCore Gateway  
 Amazon Bedrock AgentCore Observability  
 Amazon Bedrock AgentCore Memory  
 Amazon Bedrock AgentCore Policy  
 Amazon CloudWatch  
 Amazon Bedrock model inference

*What topic category does your talk fit into?*  
 Generative AI, AI/ML  
 Architecture

*Content level:*  
 **300**

*Do you have any additional information you would like to share with the selection team?*  
 This session sits at the boundary of product thinking and systems engineering. It is not a generic AI cost-optimization talk and not a pricing-page walkthrough. The core question is whether a problem is worth solving with an agent once all workflow costs are counted.

The talk is built around Amazon Bedrock AgentCore because AgentCore exposes the right operational surfaces for this discussion: Runtime, Gateway, Memory, Policy, and Observability are modular, usage-based components, and AgentCore Observability surfaces traces and telemetry in CloudWatch. Runtime usage is tracked through CPU and memory telemetry, Gateway publishes invocation and usage metrics plus trace-correlated logs, and pricing is modular across Runtime, Gateway, Memory, Policy, Observability, and Evaluations.

The structure is intentionally tight for 30 minutes: one business equation, one architecture diagram, one cost ledger, one worked example, and one before/after comparison. The audience leaves with a reusable method for deciding whether an agentic workflow should scale at all.

# Spanish

## CFP

Título propuesto para Dev Chat (13–70 caracteres CON espacios)

**La Economía de los Agentes de IA**

Descripción/resumen propuesto para Dev Chat (menos de 100 palabras)

Un agente de IA solo es bueno cuando el problema que resuelve vale más que el costo de resolverlo. En esta charla, explicaré cómo calcular el **Costo por Resultado** y mostraré cómo medir los costos reales de un agente construido sobre **Amazon Bedrock AgentCore**. Seguiremos un workflow desde la invocación hasta el resultado, contabilizando **model inference**, **AgentCore runtime**, uso de **memoria**, y llamadas a herramientas (**tool calls**). Te irás con un método práctico para decidir si un producto de IA agéntica es económicamente viable antes de ponerlo en producción y antes de perder dinero resolviendo un problema que no vale la pena resolver.

¿Qué servicios de AWS mencionarás en tu charla?

Amazon Bedrock AgentCore Runtime  
 Amazon Bedrock AgentCore Gateway  
 Amazon Bedrock AgentCore Observability  
 Amazon Bedrock AgentCore Memory  
 Amazon Bedrock AgentCore Policy  
 Amazon CloudWatch  
 Amazon Bedrock model inference

¿En qué categoría temática encaja tu charla?

Generative AI, AI/ML  
 Architecture

Nivel de contenido:

300

¿Tienes información adicional que quieras compartir con el equipo de selección?

Esta sesión se ubica en el límite entre pensamiento de producto y systems engineering. No es una charla genérica sobre AI cost optimization ni un recorrido por páginas de pricing. La pregunta central es si vale la pena resolver un problema con un agent una vez contabilizados todos los costos del workflow.

La charla está construida alrededor de **Amazon Bedrock AgentCore** porque **AgentCore** expone las superficies operativas adecuadas para esta discusión: **Runtime**, **Gateway**, **Memory**, **Policy** y **Observability** son componentes modulares y usage-based, y **AgentCore Observability** expone traces y telemetry en **CloudWatch**. El uso de **Runtime** se rastrea mediante telemetry de CPU y memoria; **Gateway** publica métricas de invocation y usage, además de logs correlacionados con traces; y el pricing es modular entre **Runtime**, **Gateway**, **Memory**, **Policy**, **Observability** y **Evaluations**.

La estructura está intencionalmente ajustada para 30 minutos: una business equation, un architecture diagram, un cost ledger, un worked example y una comparación before/after. La audiencia se va con un método reutilizable para decidir si un agentic workflow debería escalar o no.

# Talk Plan

## **Hook**

**Opening script:**  
 “Raise your hand if you've ever built something really cool with AI.”

“By the way, if you're in the front you should be turning around. Check how awesome everyone is.”

“Now, raise your hand if you've ever built something with AI that solves an actual problem.”

“Good, good. We aren't just building cool stuff, we're building valuable stuff\!”

“Now, raise your hand if you know for certain, if you've verified, that the value of solving that problem is greater than the cost of your AI solution. In US dollars, not in vibes.”

“There are a ton of talks on how to build AI solutions. From what we're seeing, you don't need those, you're already building awesome stuff\! What we're going to discuss here is how to verify that your solution is economically viable, and not just awesome.”

“We'll give you a framework to determine the value of solving a problem, and we'll dive deep into the technical details on how to measure, not guess, the cost of running your awesome solution. And no, it's not just measuring the tokens.”

## **What does the audience gain**

At the end of the talk, the audience should walk away with:

* **A business lens:** value per solved task versus cost to solve it  
* **A technical method:** how to measure that cost on Amazon Bedrock AgentCore  
* **A practical formula:** full workflow cost per accepted task  
* **A design lens:** architecture choices change economics  
* **An action list:** define the unit, instrument the workflow, calculate the number, then decide whether the product should scale

---

## **Planificación de la charla**

### Solución

Pipeline de traducción de PDFs de español a inglés

				Vectorizar texto original  	 Vectorizar texto traducido

Ingestion de doc → extraccion de texto (tool) /|\\ → traduccion /|\\	 → recomponer PDF  (tool) 

		    → extracción de imágenes (tool) → traducción de imagen (v2) →/|\\

### Parte 1: Framing del problema

- [ ] Explicar que un agente que cuesta más de lo que vale no sirve  
- [ ] Explicar cómo elegir la unidad de costo  
- [ ] Explicar framework para determinar el valor de negocio de resolver el problema  
- [ ] Explicar que hay que mirar los costos de todo, no sólo de la llamada al LLM  
- [ ] Mostrar la ecuación de costo y ver si es rentable

### Parte 2: Práctica

1. Mostrar solución v1 funcionando (sin traducción de imágenes)  
2. Explicar la arquitectura (diagrama) y lista de servicios  
3. Mostrar sólo el costo de LLM  
4. Mostrar evals  
5. Mostrar costos (mencionar que esto es costo real, no tabla de pricing)  
6. Mostrar observability  
7. Mostrar costos en base a valores reales de prod (últimos 30 días)  
8. Proponer agregar traducción de imágenes  
9. Mostrar costos con traducción de imágenes  
10. Proponer la idea de % de falla, y considerar retrabajo y escalamiento  
11. Volver a mostrar la ecuación de costo y ver si es rentable

Pendientes:

- Armar el software  
- Armar las slides  
- No más  
- Practicar

### **1\. Start with a problem that has explicit business value**

Use a workflow like a **refund-eligibility / support-resolution agent**.

Not because support is trendy, but because the economics are obvious:

* a solved case has a real value  
* some cases are cheap and deterministic  
* some cases are expensive and ambiguous  
* some require human review  
* bad acceptance rates and rework are easy to understand

The first business slide should be:

**Unit margin \= value of solving one case − cost to solve one case**

Then you say:

“Cost per verified outcome” is the precise way I’m going to calculate the cost side of that equation. It is a tool in the talk, not the message of the talk. Your paper already supports this hierarchy: page 9 defines the cost formula, but pages 21–22 make the real point that the value comes from the problem itself.

### **2\. Make the architecture slide AgentCore-first**

I would draw this as five boxes:

* **AgentCore Runtime** — the agent execution environment  
* **AgentCore Gateway** — the tool plane  
* **AgentCore Policy / Identity** — the control plane  
* **AgentCore Memory** — optional state and recall  
* **AgentCore Observability \+ CloudWatch** — traces, metrics, and logs

Then one smaller box underneath:

* **Model inference** — one component of total cost, not the center of the talk

That framing is accurate to the service. AgentCore is modular and pay-as-you-go across Runtime, Gateway, Policy, Identity, Memory, Observability, Evaluations, Browser, and Code Interpreter. Runtime uses active resource consumption, Gateway is charged by operations/search/indexing, Memory is charged by events/storage/retrieval, and Observability is charged through CloudWatch telemetry ingestion/storage/query.

### **3\. Show exactly what must be measured for one run**

For each agent run, capture a single business identifier such as `run_id`, plus the business outcome type:

* `accepted`  
* `escalated_to_human`  
* `rejected`  
* `remediated_later`

Then build a per-run ledger with these cost components:

* **Model inference cost**  
* **AgentCore Runtime cost**  
* **Gateway / tool cost**  
* **Memory cost**  
* **Policy authorization cost** if Policy is in the path  
* **Built-in tool cost** if Browser or Code Interpreter is used  
* **External API fees**  
* **Human review cost**  
* **Failure remediation / rework cost**

This is the core teaching moment: the audience sees that “model cost” is just one row in the ledger.

### **4\. Show how AgentCore gives you the raw data**

This is the concrete AWS part.

AgentCore Observability provides step-by-step workflow views and telemetry for session count, latency, duration, token usage, and error rates in CloudWatch. Runtime emits CPU and memory usage metrics such as `CPUUsed-vCPUHours` and `MemoryUsed-GBHours`, plus session-level usage logs. Gateway publishes invocation metrics, duration, target execution time, and vended logs with request/response data plus `trace_id` and `span_id` for correlation. Built-in tools and Memory have their own observability and usage surfaces as well.

If the agent is using Bedrock-hosted models, Bedrock gives you two clean extra levers for cost accounting: the Converse API supports request metadata for filtering logs and returns usage information, and application inference profiles let you track model usage and cost with tags.

### **5\. Put the formula on one slide**

I would use this exact flow:

Cost to solve one task  
\= model inference  
\+ AgentCore runtime  
\+ gateway/tool operations  
\+ memory operations  
\+ policy checks  
\+ built-in tool compute  
\+ external API fees  
\+ human review  
\+ rework/remediation

Then:

Cost per verified outcome  
\= total cost of all attempts / number of accepted outcomes

Then:

Unit margin  
\= value of solving one problem \- cost per verified outcome

And if you want the more complete business version:

Net unit margin  
\= value per solved task  
\- cost per verified outcome  
\- allocated platform overhead

That is the point where “cost per verified outcome” becomes useful: it is the disciplined way to calculate the cost side of unit economics.

### **6\. Use a before/after example, not just the formula**

This is where the talk becomes memorable.

**Bad version of the agent:**

* every case goes to the expensive reasoning path  
* the agent uses tool calls for things that should have been deterministic code  
* too many cases go to human review  
* memory is written too aggressively  
* multi-step handoffs duplicate context  
* acceptance rate is mediocre, so rework is high

**Improved version:**

* simple cases are handled deterministically or routed to a smaller path  
* expensive reasoning is only used when justified  
* human review is narrowed to higher-risk cases  
* memory is only used where it changes outcome quality  
* tool surface is smaller  
* acceptance rate improves, so remediation drops

That matches your whitepaper’s strongest operational lessons: do not over-engineer tools, route intelligently, and treat multi-agent/context duplication as a real economic cost.

### **7\. The line I would use to frame the entire second half**

**“This is not about finding the cheapest model. It is about measuring the full cost of solving one problem on AgentCore, and deciding whether the problem deserves to be automated at all.”**

That is the sentence the talk should keep returning to.

---

## **The one change I would make to your previous language**

I would stop leading with **Cost per Verified Outcome**.

I would lead with:

**“Unit economics asks whether the problem is worth solving at the cost of solving it.”**

Then, once the audience accepts that framing, I would say:

**“To calculate the cost side rigorously, I’m going to use cost per verified outcome.”**

That keeps the title exactly where you want it and makes the metric serve the talk instead of becoming the talk.
