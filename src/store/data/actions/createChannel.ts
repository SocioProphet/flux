import { createChannel } from "@/core/methods/createChannel";
import { useAppStore } from "@/store/app";
import { ChannelState, MembraneType } from "@/store/types";
import { useDataStore } from "..";
import { useUserStore } from "@/store/user";

export interface Payload {
  communityId: string;
  name: string;
}

export default async (payload: Payload): Promise<ChannelState> => {
  const dataStore = useDataStore();
  const appStore = useAppStore();
  const userStore = useUserStore();
  try {
    const community = dataStore.getCommunity(payload.communityId);

    if (community.neighbourhood !== undefined) {
      const channel = await createChannel({
        channelName: payload.name,
        creatorDid: userStore.getUser!.agent.did || "",
        sourcePerspective: community.neighbourhood.perspective,
        membraneType: MembraneType.Inherited,
        typedExpressionLanguages:
          community.neighbourhood.typedExpressionLanguages,
      });

      dataStore.addChannel({
        communityId: community.neighbourhood.perspective.uuid,
        channel,
      });

      return channel;
    } else {
      const message = "Community does not exists";
      appStore.showDangerToast({
        message,
      });
      throw Error(message);
    }
  } catch (e) {
    appStore.showDangerToast({
      message: e.message,
    });
    throw new Error(e);
  }
};
