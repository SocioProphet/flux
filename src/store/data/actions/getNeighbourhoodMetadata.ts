import { print } from "graphql/language/printer";
import { expressionGetRetries, expressionGetDelayMs } from "@/core/juntoTypes";
import { GET_EXPRESSION, PERSPECTIVE_LINK_QUERY } from "@/core/graphql_queries";
import { LinkQuery } from "@perspect3vism/ad4m";

import { dataActionContext } from "@/store/data/index";

export interface Payload {
  communityId: string;
}

const expressionWorker = new Worker("pollingWorker.js");

/// Function that uses web workers to poll for channels and new group expressions on a community
export default async (
  context: any,
  { communityId }: Payload
): Promise<Worker> => {
  const { commit: dataCommit, getters: dataGetters } =
    dataActionContext(context);

  try {
    //NOTE/TODO: if this becomes too heavy for certain communities this might be best executed via a refresh button
    const community = dataGetters.getCommunity(communityId);

    const groupExpressionWorker = new Worker("pollingWorker.js");
    // Start worker looking for group expression links
    groupExpressionWorker.postMessage({
      interval: 5000,
      query: print(PERSPECTIVE_LINK_QUERY),
      variables: {
        uuid: community.neighbourhood.perspective.uuid,
        query: new LinkQuery({
          source: `${community.neighbourhood.neighbourhoodUrl}://self`,
          predicate: "rdf://class",
        }),
      },
      name: `Get group expression links for community: ${community.neighbourhood.name}`,
    });

    groupExpressionWorker.onerror = function (e) {
      throw new Error(e.toString());
    };

    //Add event listener for receiving links grabbed by the worker
    groupExpressionWorker.addEventListener("message", async (e) => {
      try {
        let groupExpressionLinks = e.data.perspectiveQueryLinks;
        //console.log("Got group expression links", groupExpressionLinks);
        if (groupExpressionLinks != null && groupExpressionLinks.length > 0) {
          groupExpressionLinks = e.data.perspectiveQueryLinks.sort(
            //@ts-ignore
            (a, b) =>
              a.timestamp > b.timestamp ? 1 : b.timestamp > a.timestamp ? -1 : 0
          );
          //Check that the group expression ref is not in the store
          if (
            community.neighbourhood.groupExpressionRef !=
            groupExpressionLinks[groupExpressionLinks.length - 1].data!.target!
          ) {
            //Start a worker polling to try and get the expression data
            expressionWorker.postMessage({
              retry: expressionGetRetries,
              interval: expressionGetDelayMs,
              query: print(GET_EXPRESSION),
              variables: {
                url: groupExpressionLinks[groupExpressionLinks.length - 1].data!
                  .target!,
              },
              name: "Get group expression data",
              dataKey: "expression",
            });

            expressionWorker.onerror = function (e) {
              throw new Error(e.toString());
            };

            expressionWorker.addEventListener("message", (e) => {
              const getExpRes = e.data.expression;
              const groupExpData = JSON.parse(getExpRes.data!);
              console.log(
                "Got new group expression data for community",
                groupExpData
              );
              //Update the community with the new group data
              dataCommit.updateCommunityMetadata({
                communityId: community.neighbourhood.perspective.uuid,
                name: groupExpData["name"],
                description: groupExpData["description"],
                image: groupExpData["image"],
                thumbnail: groupExpData["thumnail"],
                groupExpressionRef:
                  groupExpressionLinks[groupExpressionLinks.length - 1].data!
                    .target,
              });
            });
          }
        }
      } catch (error) {
        throw new Error(error);
      }
    });
    return groupExpressionWorker;
  } catch (e) {
    throw new Error(e);
  }
};