import type {
  ExecutionContext,
  Middleware,
  MiddlewarePipeline,
  MaybePromise,
  ToolResult,
} from "@forgemcp/core";

type TerminalHandler<TInput, TResult> = (
  context: ExecutionContext,
  input: TInput,
) => MaybePromise<ToolResult<TResult>>;

/**
 * Default ForgeMCP middleware pipeline.
 */
export class ForgeMiddlewarePipeline<
  TInput = unknown,
  TResult = unknown,
> implements MiddlewarePipeline<TInput, TResult> {
  public constructor(
    private readonly middleware: readonly Middleware<TInput, TResult>[],
    private readonly terminal: TerminalHandler<TInput, TResult>,
  ) {}

  /**
   * Executes middleware in registration order and invokes the terminal handler.
   */
  public async execute(
    context: ExecutionContext,
    input: TInput,
  ): Promise<ToolResult<TResult>> {
    let lastIndex = -1;

    const dispatch = async (
      index: number,
      currentInput: TInput,
    ): Promise<ToolResult<TResult>> => {
      if (index <= lastIndex) {
        throw new Error("Middleware next() called multiple times.");
      }

      lastIndex = index;

      const current = this.middleware[index];

      if (current === undefined) {
        return this.terminal(context, currentInput);
      }

      return current.invoke(context, currentInput, (nextInput) =>
        dispatch(index + 1, nextInput),
      );
    };

    return dispatch(0, input);
  }
}
