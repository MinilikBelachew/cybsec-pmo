import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateProjectDto } from '../../projects/dto/create-project.dto';

/** Create a project from a template — same fields as create project, plus optional name override. */
export class InstantiateProjectTemplateDto extends CreateProjectDto {
  @ApiPropertyOptional({
    description: 'Override the new project name (defaults to the form name)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  projectName?: string;
}
