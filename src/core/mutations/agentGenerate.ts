import { apolloClient } from "@/app";
import { AgentStatusType } from "@perspect3vism/ad4m";
import unwrapApolloResult from "@/utils/unwrapApolloResult";
import { AGENT_GENERATE } from "../graphql_queries";

//Query expression handler
export async function agentGenerate(passphrase: string): Promise<AgentStatusType> {
  const { agentGenerate } = unwrapApolloResult(
    await apolloClient.mutate({
      mutation: AGENT_GENERATE,
      variables: { passphrase },
    })
  );
  return new AgentStatusType(agentGenerate);
}
