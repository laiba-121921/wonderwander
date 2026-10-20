import { Link } from 'react-router-dom';
import { KEY_ERRORS, LLM_MESSAGE, type LlmError } from '../engines/grading/llm';

// A checking failure, with a way to Settings when the fix is the Gemini key (PHASE_15_PLUS 4.3).
export function LlmErrorText({ error }: { error: LlmError }) {
  return (
    <>
      <p>{LLM_MESSAGE[error]}</p>
      {KEY_ERRORS.includes(error) && (
        <Link to="/me#gemini-key" className="mt-2 inline-flex min-h-12 items-center font-semibold">
          Open Settings
        </Link>
      )}
    </>
  );
}
