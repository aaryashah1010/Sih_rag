import type { EvidenceSearchRequest, EvidenceSearchResponse, RagCaller, RagClient } from "../ports/rag-client.js";

export class EvidenceSearchService {
  constructor(private readonly rag: RagClient) {}

  search(request: EvidenceSearchRequest, caller: RagCaller): Promise<EvidenceSearchResponse> {
    return this.rag.searchEvidence(request, caller);
  }
}
