# Regulatory Copilot — Implementation Report

## Executive summary

Regulatory Copilot is a working technical prototype of a private development assistant for regulated software teams. It operates inside VS Code, runs an open coding model on private GPU infrastructure, and retrieves supporting evidence from a controlled knowledge base before answering domain questions.

The implementation demonstrates the core workflow proposed for the project: Continue provides the developer interface, Qwen2.5-Coder is served through vLLM, Outline manages approved knowledge, and a read-only Model Context Protocol (MCP) adapter connects the assistant to that knowledge. The prototype produced page-cited answers from FDA guidance and passed all five prepared retrieval tests.

## Delivered solution

| Area | Implementation | Status |
| --- | --- | --- |
| Developer interface | Continue in VS Code | Complete |
| Private inference | Qwen2.5-Coder 14B AWQ through vLLM | Complete |
| Secure model access | SSH local forwarding to a loopback-only endpoint | Complete |
| Knowledge platform | Outline with PostgreSQL and Redis | Complete |
| Knowledge integration | Read-only MCP search and retrieval adapter | Complete |
| Demonstration corpus | Three public FDA guidance documents with PDF page markers | Complete |
| Validation | Five repeatable retrieval cases | Complete |
| Production hardening | Enterprise security, operations, and governance | Deferred |

## Operating model

Coding requests travel from Continue through an SSH tunnel to vLLM on the private GPU server. Regulatory requests can invoke the MCP adapter, which searches Outline and returns relevant evidence to the model. The resulting answer can identify the source document and retained PDF page marker.

The prototype keeps model inference and knowledge management separate. This allows approved documents to be updated without retraining the model and limits the model's knowledge access to the published read-only tools.

## Key implementation decisions

**Model serving.** Qwen2.5-Coder 14B AWQ and vLLM were selected as practical implementation choices; the proposal did not prescribe a specific model or inference engine. The quantized model fits the available 24 GB GPU and vLLM provides an API compatible with Continue.

**Knowledge deployment.** Outline runs through Docker Desktop on the workstation because the managed GPU environment does not expose a Docker daemon. In a production deployment, Outline can be moved to an approved shared server while retaining the same MCP integration.

**Document corpus.** Public FDA guidance was used because internal company documents were not available. The ingestion process preserves explicit PDF page markers and can be applied later to authorized internal content.

**Network exposure.** vLLM remains bound to the server's loopback interface and is accessed through SSH. The prototype does not require a publicly reachable model endpoint.

## Validation result

The retrieval evaluation passed **5/5 cases**, covering:

- Software Requirements Specification guidance
- Unresolved software anomalies
- Software Bill of Materials requirements
- Off-the-shelf software risk documentation
- Cybersecurity planning documentation

Each case checks the selected source, required page markers, exclusion of table-of-contents text, and an evidence-size limit. This confirms the demonstrated retrieval path; it is not a formal regulatory validation or a comprehensive model-quality benchmark.

## Current limitations

- The knowledge base contains public FDA guidance rather than internal controlled documents.
- Outline is a single-workstation deployment with demonstration authentication.
- vLLM is operated as a prototype service rather than a centrally managed production workload.
- The evaluation set is intentionally small and focused on retrieval behavior.
- Generated answers still require qualified human review.

## Recommended next steps

1. Deploy Outline on approved shared infrastructure and integrate organizational SSO.
2. Import authorized internal procedures, standards, and approved guidance with document ownership and review metadata.
3. Add TLS, centralized secrets, backups, monitoring, audit retention, and service management.
4. Expand evaluation to cover answer accuracy, citation correctness, latency, access control, and failure handling.
5. Run a limited pilot with regulatory and software-development reviewers before considering broader use.

## Conclusion

The prototype confirms that a private VS Code assistant can combine self-hosted model inference with controlled, page-traceable regulatory retrieval. The main technical workflow is complete. The remaining work is primarily production deployment, organizational integration, governance, and formal validation.
