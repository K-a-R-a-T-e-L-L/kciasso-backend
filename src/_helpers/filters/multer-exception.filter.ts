import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import { MulterError } from 'multer'

import { ErrorCodeEnum } from '../enums/validator/error.code.enum'
import { ErrorDto } from '../errors/error.dto'

@Catch()
export class MulterExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const response = host.switchToHttp().getResponse()
        const httpException = exception instanceof HttpException ? exception : undefined
        const exceptionRecord =
            typeof exception === 'object' && exception !== null ? (exception as Record<string, unknown>) : undefined
        const status =
            httpException?.getStatus() ??
            (typeof exceptionRecord?.status === 'number' ? exceptionRecord.status : undefined)
        const code = exception instanceof MulterError ? (exception as MulterError).code : exceptionRecord?.code
        const isTooLarge = code === 'LIMIT_FILE_SIZE' || status === 413
        if (!isTooLarge) {
            if (httpException) {
                const payload = httpException.getResponse()
                response.status(status ?? 500).json(payload)
                return
            }
            response.status(500).json({ statusCode: 500, error: 'Internal Server Error' })
            return
        }
        const body = new ErrorDto(
            isTooLarge ? ErrorCodeEnum.DOCUMENT_FILE_TOO_LARGE : ErrorCodeEnum.DOCUMENT_FILE_REQUIRED,
            'Bad Request',
            400,
            isTooLarge ? 'Document file is too large' : 'Document file upload failed'
        )

        response.status(body.statusCode).json(body)
    }
}
