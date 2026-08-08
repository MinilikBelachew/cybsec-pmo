import {
  overallRag,
  scoreToRag,
} from './health-rules.constants';

describe('HealthRules scoring', () => {
  it('maps scores to green/amber/red using thresholds', () => {
    expect(scoreToRag(90, 85, 60, 0)).toBe('green');
    expect(scoreToRag(70, 85, 60, 0)).toBe('amber');
    expect(scoreToRag(40, 85, 60, 0)).toBe('red');
  });

  it('rolls up overall RAG with red taking precedence', () => {
    expect(overallRag(['green', 'amber', 'green'])).toBe('amber');
    expect(overallRag(['green', 'red', 'amber'])).toBe('red');
    expect(overallRag(['green', 'green'])).toBe('green');
  });
});
