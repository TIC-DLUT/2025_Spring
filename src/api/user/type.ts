//登录接口 Form
export interface LoginForm {
    telephone: string,
    password: string,

}

//登录接口 Response
export interface LoginResponse {
    code: number,
    token: string,
    message: string,
}

//注册接口 Response
export interface RegisterResponse {
    code: number,
    message: string,
}