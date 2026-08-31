import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // @Public() acá no es opcional: con JwtAuthGuard como guard global (Story
  // 4), esta ruta necesitaría un Bearer para poder... emitir un Bearer. Sin
  // esto, nadie puede loguearse nunca — ni los scripts de scripts/.
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}
