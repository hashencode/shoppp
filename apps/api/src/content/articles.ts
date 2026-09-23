import type { ContentArticleWriteRequest, ContentTransitionRequest } from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import {
  createContent,
  getContent,
  listContent,
  transitionContent,
  updateContent,
} from "./resources";

export const listArticles = (db: D1Database, query: Parameters<typeof listContent>[2]) =>
  listContent(db, "article", query);
export const getArticle = (db: D1Database, id: string) => getContent(db, "article", id);
export const createArticle = (
  context: Context<ApiEnvironment>,
  input: ContentArticleWriteRequest,
) => createContent(context, "article", input);
export const updateArticle = (
  context: Context<ApiEnvironment>,
  id: string,
  input: ContentArticleWriteRequest,
) => updateContent(context, "article", id, input);
export const publishArticle = (
  context: Context<ApiEnvironment>,
  id: string,
  input: ContentTransitionRequest,
) => transitionContent(context, "article", id, input, "publish");
export const archiveArticle = (
  context: Context<ApiEnvironment>,
  id: string,
  input: ContentTransitionRequest,
) => transitionContent(context, "article", id, input, "archive");
