<template>
  <j-flex direction="column" gap="400" class="steps">
    <j-text variant="heading">Add a link to profile</j-text>
    <j-input
      label="Web link"
      size="xl"
      :value="link"
      @input="(e) => (link = e.target.value)"
      :error="linkError"
      :errorText="linkErrorMessage"
      @blur="getMeta"
    >
    </j-input>

    <j-flex a="center" gap="500">
      <avatar-upload
        size="3rem"
        :value="newProfileImage"
        @change="(val) => (newProfileImage = val)"
        icon="camera"
      />
      <j-flex style="width: 100%" gap="400" direction="column">
        <j-input
          label="Title"
          size="xl"
          :value="title"
          @input="(e) => (title = e.target.value)"
          :error="titleError"
          :errorText="titleErrorMessage"
          @blur="(e) => validateTitle"
        ></j-input>
        <j-input
          label="Description"
          size="xl"
          :value="description"
          @input="(e) => (description = e.target.value)"
          @keydown.enter="createLink"
        ></j-input>
      </j-flex>
    </j-flex>
    <j-flex gap="400">
      <j-button full style="width: 100%" size="lg" @click="$emit('cancel')">
        <j-icon v-if="!isEditing" slot="start" name="arrow-left-short" />
        {{ isEditing ? "Cancel" : "Back" }}
      </j-button>
      <j-button
        style="width: 100%"
        full
        :disabled="isAddLink || !canCreateLink"
        :loading="isAddLink"
        size="lg"
        variant="primary"
        @click="createLink"
      >
        <j-icon slot="end" name="add" />
        {{ isEditing ? "Save" : "Add link" }}
      </j-button>
    </j-flex>
  </j-flex>
</template>

<script lang="ts">
import { ad4mClient } from "@/app";
import { NOTE_IPFS_EXPRESSION_OFFICIAL } from "@/constants/languages";
import { useAppStore } from "@/store/app";
import { useUserStore } from "@/store/user";
import getAgentLinks from "@/utils/getAgentLinks";
import { useValidation } from "@/utils/validation";
import { Link, PerspectiveInput } from "@perspect3vism/ad4m";
import { defineComponent, ref } from "vue";
import AvatarUpload from "@/components/avatar-upload/AvatarUpload.vue";
import { nanoid } from "nanoid";
import removeTypeName from "@/utils/removeTypeName";

export default defineComponent({
  props: ["step", "area", "isEditing"],
  emits: ["cancel", "submit"],
  components: {
    AvatarUpload,
  },
  setup() {
    const isAddLink = ref(false);
    const newProfileImage = ref("");
    const description = ref("");

    const {
      value: title,
      error: titleError,
      errorMessage: titleErrorMessage,
      isValid: titleIsValid,
      validate: validateTitle,
    } = useValidation({
      initialValue: "",
      rules: [
        {
          check: (value: string) => (value ? false : true),
          message: "Title is required",
        },
        {
          check: (value: string) => value.length < 3,
          message: "Should be 3 or more characters",
        },
      ],
    });

    // TODO: update validation rules for link
    const {
      value: link,
      error: linkError,
      errorMessage: linkErrorMessage,
      isValid: linkIsValid,
      validate: validateLink,
    } = useValidation({
      initialValue: "",
      rules: [
        {
          check: (value: string) => (value ? false : true),
          message: "link is required",
        },
        {
          check: (value: string) => value.length < 3,
          message: "Should be 3 or more characters",
        },
        {
          check: (value: string) => {
            const regex =
              /[(http(s)?)://(www.)?a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/;

            return !regex.test(value);
          },
          message: "Link is invalid",
        },
      ],
    });

    return {
      title,
      titleError,
      titleErrorMessage,
      titleIsValid,
      validateTitle,
      description,
      link,
      linkError,
      linkErrorMessage,
      linkIsValid,
      validateLink,
      isAddLink,
      newProfileImage,
    };
  },
  computed: {
    canCreateLink(): boolean {
      return this.titleIsValid;
    },
    canAddLink(): boolean {
      return this.linkIsValid;
    },
  },
  watch: {
    area: {
      handler: function (area) {
        this.title = area?.has_name ?? "";
        this.description = area?.has_description ?? "";
        this.link = area?.has_post ?? "";
        this.newProfileImage = area?.has_image ?? "";
      },
      immediate: true,
      deep: true,
    },
  },
  methods: {
    async getMeta() {
      try {
        const res = await fetch(
          "http://url-metadata.herokuapp.com/api/metadata?url=" + this.link
        );
        const { data } = await res.json();
        console.log({ data });
        this.title = data.title;
        this.description = data.description;

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result;
          console.log({ base64data });
          if (base64data) {
            this.newProfileImage = base64data.toString();
          }
        };
        const { hostname } = new URL(this.link);
        const image = await fetch(
          "https://services.keeweb.info/favicon/" + hostname
        );
        console.log(image);
        const blob = await image.blob();
        console.log(blob);
        reader.readAsDataURL(blob);
      } catch (e) {
        console.log(e);
      }
    },
    async createLink() {
      if (this.canCreateLink && !this.isAddLink) {
        this.isAddLink = true;

        const userStore = useUserStore();
        const appStore = useAppStore();
        const userPerspective = userStore.getFluxPerspectiveId;

        const did = userStore.getUser?.agent.did;

        const preLinks = await getAgentLinks(did!, userPerspective!);

        const preArea: { [x: string]: any } = {};

        preLinks.forEach((e: any) => {
          const predicate = e.data.predicate.split("://")[1];
          if (!preArea[e.data.source]) {
            preArea[e.data.source] = {
              [predicate]:
                predicate === "has_post"
                  ? e.data.target
                  : e.data.predicate.split("://")[1],
            };
          }

          preArea[e.data.source][predicate] = e.data.predicate.split("://")[1];
        });
        console.log("preLinks", preLinks);
        const id = await nanoid();

        let areaName = this.area?.id ?? `area://${id}`;

        if (!this.area?.id) {
          await ad4mClient.perspective.addLink(
            userPerspective!,
            new Link({
              source: `flux://profile`,
              target: areaName,
              predicate: "flux://has_area",
            })
          );
        }

        if (this.area?.id) {
          const foundLinks = preLinks.filter(
            (e) => e.data.source === this.area?.id
          );

          for (const foundLink of foundLinks) {
            const link = removeTypeName(foundLink);
            await ad4mClient.perspective.removeLink(userPerspective!, link);
          }
        }

        await ad4mClient.perspective.addLink(
          userPerspective!,
          new Link({
            source: areaName,
            target: this.link,
            predicate: "sioc://has_post",
          })
        );
        await ad4mClient.perspective.addLink(
          userPerspective!,
          new Link({
            source: areaName,
            target: `flux://webLink`,
            predicate: "flux://area_type",
          })
        );
        await ad4mClient.perspective.addLink(
          userPerspective!,
          new Link({
            source: areaName,
            target: `text://${this.title}`,
            predicate: "sioc://has_name",
          })
        );
        await ad4mClient.perspective.addLink(
          userPerspective!,
          new Link({
            source: areaName,
            target: `text://${this.description}`,
            predicate: "sioc://has_description",
          })
        );

        if (this.newProfileImage) {
          const storedImage = await ad4mClient.expression.create(
            this.newProfileImage,
            NOTE_IPFS_EXPRESSION_OFFICIAL
          );
          await ad4mClient.perspective.addLink(
            userPerspective!,
            new Link({
              source: areaName,
              target: storedImage,
              predicate: "sioc://has_image",
            })
          );
        }

        const newLinks = await getAgentLinks(did!, userPerspective!);

        const links = [];
        //Remove __typename fields so the next gql does not fail
        for (const link in newLinks) {
          //Deep copy the object... so we can delete __typename fields inject by apollo client
          const newLink = JSON.parse(JSON.stringify(newLinks[link]));
          newLink.__typename = undefined;
          newLink.data.__typename = undefined;
          newLink.proof.__typename = undefined;
          links.push(newLink);
        }
        await ad4mClient.agent.updatePublicPerspective({
          links,
        } as PerspectiveInput);
        // await ad4mClient.perspective.remove()
        this.link = "";
        appStore.showSuccessToast({
          message: "Link added to agent perspective",
        });

        this.title = "";
        this.description = "";
        this.link = "";
        this.newProfileImage = "";
        this.isAddLink = false;

        this.$emit("submit");
      }
    },
    addLink() {
      this.validateLink();
    },
  },
});
</script>

<style scoped>
.grid {
  display: flex;
  flex-wrap: wrap;
}

.add {
  width: 150px;
  height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid grey;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 20px;
  margin-bottom: 20px;
}

.img_container {
  position: relative;
  margin-right: 20px;
  margin-bottom: 20px;
}

.img_bg {
  width: 150px;
  height: 150px;
  border: 1px solid grey;
  border-radius: 4px;
  cursor: pointer;
}

.close {
  position: absolute;
  top: 0;
  left: 0;
}

.steps {
  width: 100%;
}
</style>
