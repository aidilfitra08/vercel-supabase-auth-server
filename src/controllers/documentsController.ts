import { Request, Response } from "express";
import { getQdrantService } from "../services/qdrant.js";

export const storeDocument = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id, text, metadata = {} } = req.body;

    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }

    const qdrant = getQdrantService();

    // Add user_id to metadata
    const docMetadata = {
      ...metadata,
      user_id: user.id,
      created_at: new Date().toISOString(),
    };

    // Generate ID if not provided
    const docId = id || `${user.id}_${Date.now()}`;

    await qdrant.storeDocument(docId, text, docMetadata);

    res.status(201).json({
      message: "document stored successfully",
      id: docId,
    });
  } catch (error: any) {
    console.error("Store document error:", error);
    res
      .status(500)
      .json({ error: error.message || "failed to store document" });
  }
};

export const storeBatchDocuments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { documents } = req.body;

    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: "documents array is required" });
    }

    if (documents.length > 100) {
      return res.status(400).json({ error: "maximum 100 documents per batch" });
    }

    const qdrant = getQdrantService();

    // Prepare documents with user_id
    const preparedDocs = documents.map((doc, index) => ({
      id: doc.id || `${user.id}_${Date.now()}_${index}`,
      text: doc.text,
      metadata: {
        ...doc.metadata,
        user_id: user.id,
        created_at: new Date().toISOString(),
      },
    }));

    await qdrant.storeBatch(preparedDocs);

    res.status(201).json({
      message: "documents stored successfully",
      count: preparedDocs.length,
      ids: preparedDocs.map((d) => d.id),
    });
  } catch (error: any) {
    console.error("Store batch error:", error);
    res
      .status(500)
      .json({ error: error.message || "failed to store documents" });
  }
};

export const searchDocuments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { query, limit = 5, global = false } = req.body;

    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }

    const qdrant = getQdrantService();

    // Search user-specific or global
    const results = global
      ? await qdrant.search(query, limit)
      : await qdrant.searchByUser(query, user.id, limit);

    res.json({
      query,
      results,
      count: results.length,
    });
  } catch (error: any) {
    console.error("Search error:", error);
    res.status(500).json({ error: error.message || "search failed" });
  }
};

export const getDocumentById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const qdrant = getQdrantService();

    const document = await qdrant.getDocument(id);

    if (!document) {
      return res.status(404).json({ error: "document not found" });
    }

    res.json({ document });
  } catch (error: any) {
    console.error("Get document error:", error);
    res.status(500).json({ error: error.message || "failed to get document" });
  }
};

export const listDocuments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const qdrant = getQdrantService();

    const documents = await qdrant.listDocuments(user.id, limit, offset);
    const total = await qdrant.countDocuments(user.id);

    res.json({
      documents,
      count: documents.length,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("List documents error:", error);
    res
      .status(500)
      .json({ error: error.message || "failed to list documents" });
  }
};

export const deleteDocument = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const qdrant = getQdrantService();

    await qdrant.deleteDocument(id);

    res.json({ message: "document deleted successfully", id });
  } catch (error: any) {
    console.error("Delete document error:", error);
    res
      .status(500)
      .json({ error: error.message || "failed to delete document" });
  }
};

export const deleteAllUserDocuments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const qdrant = getQdrantService();

    await qdrant.deleteByUser(user.id);

    res.json({ message: "all documents deleted successfully" });
  } catch (error: any) {
    console.error("Delete all error:", error);
    res
      .status(500)
      .json({ error: error.message || "failed to delete documents" });
  }
};

export const checkQdrantHealth = async (req: Request, res: Response) => {
  try {
    const qdrant = getQdrantService();
    const healthy = await qdrant.healthCheck();

    if (healthy) {
      res.json({ status: "healthy", qdrant: "connected" });
    } else {
      res.status(503).json({ status: "unhealthy", qdrant: "disconnected" });
    }
  } catch (error: any) {
    res.status(503).json({ status: "unhealthy", error: error.message });
  }
};
