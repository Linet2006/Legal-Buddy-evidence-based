import { describe, it, expect } from 'vitest';
import { chunkDocument, retrieveRelevantChunks } from '../chunker.js';

describe('Document Chunker & Retriever Tests', () => {
  it('should create chunks from a single page', () => {
    const pages = [
      { pageNumber: 1, text: "This is a simple test document. It contains some text that should be chunked. We are ensuring the chunker works securely and efficiently without dropping data." }
    ];
    
    // Using a tiny maxChunkSize for testing
    const chunks = chunkDocument(pages, 10); 
    
    expect(chunks).toBeInstanceOf(Array);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toHaveProperty('page', 1);
    expect(chunks[0]).toHaveProperty('text');
    expect(typeof chunks[0].text).toBe('string');
  });

  it('should retrieve the most relevant chunks based on a query', () => {
    const mockChunks = [
      { page: 1, text: "The landlord is responsible for all major plumbing repairs." },
      { page: 2, text: "The tenant must pay rent by the 5th of every month." },
      { page: 3, text: "Pets are strictly prohibited without written consent." }
    ];

    const query = "When is the rent due?";
    
    const relevant = retrieveRelevantChunks(mockChunks, query, 1);
    
    expect(relevant.length).toBe(1);
    // Even with simple keyword overlap, 'rent' should match the 2nd chunk
    expect(relevant[0].page).toBe(2);
    expect(relevant[0].text).toContain('pay rent');
  });
});
