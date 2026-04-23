// 记录相关接口 Response
export interface RecordAddResponse {
  code: number;
  message: string;
}

export interface RecordGetResponse {
  code: number;
  message: string;
  data: string[];
}

export interface RecordDeleteResponse {
  code: number;
  message: string;
}
