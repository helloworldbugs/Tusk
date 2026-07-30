<script>
export default {
  props: {
    unlockedState: Object,
    keepassService: Object,
  },
  data() {
    return {
      searchTerm: '',
      expandedGroups: {},
    };
  },
  mounted() {
    let groups = this.keepassService.getGroups() || [];
    // Auto-expand if single group
    if (groups.length === 1) {
      this.$set(this.expandedGroups, groups[0].name, true);
    }
  },
  computed: {
    allEntries() {
      return this.unlockedState.cacheGet('allEntries') || [];
    },
    groups() {
      return this.keepassService.getGroups() || [];
    },
  },
  methods: {
    toggleGroup(name) {
      this.$set(this.expandedGroups, name, !this.expandedGroups[name]);
    },
    getGroupEntries(name) {
      let result = this.allEntries.filter(e => e.groupName === name);
      if (this.searchTerm.length > 0) {
        let term = this.searchTerm.toLowerCase();
        result = result.filter(e => (e.filterKey || '').indexOf(term) > -1);
      }
      return result;
    },
    autofill(entry) {
      this.unlockedState.autofill(entry);
    },
    editEntry(entry) {
      this.$router.route('/entry-edit/' + entry.id);
    },
  },
};
</script>

<template>
  <div id="browse-panel">
    <div class="search">
      <i class="fa fa-search" />
      <input v-model="searchTerm" type="search" placeholder="search..." />
    </div>
    <div class="browse-groups">
      <div v-for="group in groups" :key="group.name" class="group-section">
        <div class="group-header selectable" @click="toggleGroup(group.name)">
          <i :class="['fa', expandedGroups[group.name] ? 'fa-folder-open' : 'fa-folder', 'fa-fw']" />
          <span class="group-name">{{ group.name }}</span>
          <span class="group-count">{{ getGroupEntries(group.name).length }}</span>
        </div>
        <div v-if="expandedGroups[group.name]" class="group-entries">
          <div
            v-for="entry in getGroupEntries(group.name)"
            :key="entry.id"
            class="entry-row selectable"
            @click="autofill(entry)"
          >
            <div class="entry-info">
              <span class="entry-title">{{ entry.title || '(empty)' }}</span>
              <span class="entry-user">{{ entry.userName || '' }}</span>
            </div>
            <span class="fa-stack entry-edit" @click.stop="editEntry(entry)">
              <i class="fa fa-circle fa-stack-2x" />
              <i class="fa fa-pencil fa-stack-1x fa-inverse" />
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import '../styles/settings.scss';

#browse-panel {
  height: 400px;
  display: flex;
  flex-direction: column;
}

.search {
  padding: 8px $wall-padding;
  border-bottom: 2px solid $light-gray;
  display: flex;
  align-items: center;
  input {
    flex: 1; border: 0; padding-left: 10px;
    font-size: 16px; background: transparent;
    &:focus { outline: none; }
  }
}

.browse-groups {
  flex: 1;
  overflow-y: auto;
}

.group-header {
  padding: 8px $wall-padding;
  border-bottom: 1px solid $light-gray;
  background: $light-background-color;
  display: flex; align-items: center; gap: 6px;
  &:hover { opacity: 0.7; }
  .group-name { font-weight: 600; font-size: 14px; }
  .group-count { margin-left: auto; font-size: 12px; color: #999; }
}

.group-entries {
  .entry-row {
    display: flex; align-items: center;
    padding: 8px $wall-padding;
    border-bottom: 1px solid lighten($light-gray, 5%);
    &:hover { background: darken($background-color, 3%); }
    .entry-info {
      flex: 1;
      .entry-title { font-size: 14px; display: block; }
      .entry-user { font-size: 11px; color: #666; }
    }
    .entry-edit { opacity: 0.3; font-size: 16px; &:hover { opacity: 0.8; } }
  }
}
</style>
