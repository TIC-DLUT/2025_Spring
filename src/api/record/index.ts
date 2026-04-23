// 记录相关接口
import request from "@/utils/request.ts";
import type {
  RecordAddResponse,
  RecordGetResponse,
  RecordDeleteResponse,
} from "@/api/record/type.ts";

enum API {
  ADD_URL = "/record/add",
  GET_URL = "/record/get",
  DELETE_URL = "/record/delete",
}

// 添加对话记录
export const reqRecordAdd = (question: string): Promise<RecordAddResponse> =>
  request.post(API.ADD_URL, { question });

// 获取对话记录
export const reqRecordGet = (): Promise<RecordGetResponse> =>
  request.get(API.GET_URL);

// 删除对话记录
export const reqRecordDelete = (): Promise<RecordDeleteResponse> =>
  request.post(API.DELETE_URL);
