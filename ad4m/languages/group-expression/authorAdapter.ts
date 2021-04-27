import type Expression from "ad4m/Expression";
import type Agent from "ad4m/Agent";
import type { GetByAuthorAdapter } from "ad4m/Language";
import type LanguageContext from "language-context/lib/LanguageContext";
import type { default as HolochainLanguageDelegate } from "language-context/lib/Holochain/HolochainLanguageDelegate";
import { DNA_NICK } from "./dna";

export default class ShortFormAuthorAdapter implements GetByAuthorAdapter {
  #hcDNA: HolochainLanguageDelegate;

  constructor(context: LanguageContext) {
    this.#hcDNA = context.Holochain as HolochainLanguageDelegate;
  }

  //Question: For this author; assuming we resolved with profile DHT; how do we know which agent to use if they have multiple listed?
  //might not be a clear 1:1 mapping for did to agents
  ///Get expressions authored by a given Agent/Identity
  async getByAuthor(
    author: Agent,
    count: number,
    page: number
  ): Promise<void | Expression[]> {
    //TODO: resolve did
    const res = await this.#hcDNA.call(
      DNA_NICK,
      "group-expression",
      "get_by_author",
      { author: author.did, page_size: count, page_number: page }
    );
    const out = [];
    res.forEach((expression) => {
      const ad4mExpression: Expression = Object.assign(
        expression.expression_data
      );
      out.push(ad4mExpression);
    });
    return out;
  }
}