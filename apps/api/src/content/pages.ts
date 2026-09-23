import type { ContentPageWriteRequest, ContentTransitionRequest } from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import {
  createContent,
  getContent,
  listContent,
  transitionContent,
  updateContent,
} from "./resources";

export const listPages = (db: D1Database, query: Parameters<typeof listContent>[2]) =>
  listContent(db, "page", query);
export const getPage = (db: D1Database, id: string) => getContent(db, "page", id);
export const createPage = (context: Context<ApiEnvironment>, input: ContentPageWriteRequest) =>
  createContent(context, "page", input);
export const updatePage = (
  context: Context<ApiEnvironment>,
  id: string,
  input: ContentPageWriteRequest,
) => updateContent(context, "page", id, input);
export const publishPage = (
  context: Context<ApiEnvironment>,
  id: string,
  input: ContentTransitionRequest,
) => transitionContent(context, "page", id, input, "publish");
export const archivePage = (
  context: Context<ApiEnvironment>,
  id: string,
  input: ContentTransitionRequest,
) => transitionContent(context, "page", id, input, "archive");
