<script>
import { parseUrl } from '@/lib/utils.js';
export default {
  props: {
    entry: Object,
    unlockedState: Object,
  },
  computed: {
    header: function () {
      if (this.entry.title.length > 0) return this.entry.title;
      return this.entry.url;
    },
  },
  watch: {
    // When the element becomes active, scroll it into view.
    'entry.view_is_active': function (val) {
      if (val)
        this.$el.scrollIntoView({
          block: 'end',
          inline: 'nearest',
          behavior: 'smooth',
        });
    },
  },
  methods: {
    details(e) {
      e.stopPropagation();
      this.$router.route('/entry-details/' + this.entry.id);
    },
    autofill(e) {
      e.stopPropagation();
      this.unlockedState.autofill(this.entry);
    },
    copy(e) {
      e.stopPropagation();
      this.unlockedState.copyPassword(this.entry);
    },
    openUrl(e) {
      e.stopPropagation();
      if (this.entry.url) chrome.tabs.create({ url: this.entry.url });
    },
    edit(e) {
      e.stopPropagation();
      this.$router.route('/entry-edit/' + this.entry.id);
    },
  },
};
</script>

<template>
    <div
    class="entry-list-item selectable between flair"
    :class="{ active: entry.view_is_active }"
    @click="autofill"
  >
    <div class="text-info" :class="{ strike: entry.is_expired }">
      <span class="header">{{ header }}</span>
      <br />
      <span class="user">
        {{ entry.userName || $t('(empty)') }}
      </span>
      <span v-if="entry.groupName" class="group-label">{{ entry.groupName }}</span>
    </div>
    <div class="buttons">
      <span class="fa-stack url" @click="openUrl">
        <i class="fa fa-circle fa-stack-2x" />
        <i class="fa fa-external-link fa-stack-1x fa-inverse" />
      </span>
      <span class="fa-stack copy" @click="copy">
        <i class="fa fa-circle fa-stack-2x" />
        <i class="fa fa-clipboard fa-stack-1x fa-inverse" />
      </span>
      <span class="fa-stack edit" @click="edit">
        <i class="fa fa-circle fa-stack-2x" />
        <i class="fa fa-pencil fa-stack-1x fa-inverse" />
      </span>
    </div>
  </div>
</template>

<style lang="scss">
@import '../styles/settings.scss';
.entry-list-item {
  transition: all 0.3s ease;
  width: 100%;
  padding: 10px $wall-padding;
  box-sizing: border-box;
  border-bottom: 1px solid $light-gray;
  background-color: $light-background-color;
  display: flex;
  .header {
    font-size: 16px;
  }
  .user {
    font-size: 12px;
  }
  .group-label {
    display: block;
    font-size: 10px;
    color: var(--tusk-text-muted);
    margin-top: 1px;
  }
  .buttons {
    font-size: 18px;
    display: flex;
    justify-content: space-between;
    box-sizing: border-box;
    min-width: 80px;
  }
  .copy,
  .edit,
  .url {
    opacity: 0.35;
  }
  .copy:hover,
  .edit:hover,
  .url:hover {
    opacity: 0.8;
  }
  @media (prefers-color-scheme: dark) {
    .copy,
    .edit,
    .url {
      opacity: 0.7;
    }
    .copy:hover,
    .edit:hover,
    .url:hover {
      opacity: 0.4;
    }
  }
  &.active {
    background-color: $highlighted;
    padding-left: 20px;
  }
}

.strike {
  text-decoration: line-through;
}
</style>
