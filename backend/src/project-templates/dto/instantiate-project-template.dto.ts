import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateProjectDto } from '../../projects/dto/create-project.dto';
import { PROJECT_NAME_MAX_LENGTH } from '../../projects/constants/project-limits';

/** Create a project from a template — same fields as create project, plus optional name override. */
export class InstantiateProjectTemplateDto extends CreateProjectDto {
  @ApiPropertyOptional({
    description: 'Override the new project name (defaults to the form name)',
    maxLength: PROJECT_NAME_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(PROJECT_NAME_MAX_LENGTH, {
    message: 'Project name must be 100 characters or fewer (Keka limit)',
  })
  projectName?: string;
}
