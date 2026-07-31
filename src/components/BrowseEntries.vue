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
      renamingGroup: null,
      renameInput: '',
      showNewGroup: false,
      newGroupName: '',
      busy: false,
      message: '',
      entriesVersion: 0,
    };
  },
  mounted() {
    this.$nextTick(() => {
      if (this.groups.length === 1) {
        this.$set(this.expandedGroups, this.groups[0].name, true);
      }
    });
  },
  computed: {
    allEntries() {
      this.entriesVersion; // reactive dependency — bump after cache updates
      return this.unlockedState.cacheGet('allEntries') || [];
    },
    groups() {
      this.entriesVersion; // reactive dep — bump after any group mutation
      let names = {};
      this.allEntries.forEach(e => { if (e.groupName) names[e.groupName] = true; });
      (this.keepassService.getGroups() || []).forEach(g => { names[g.name] = true; });
      return Object.keys(names).sort().map(n => ({ name: n }));
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
      this.$router.route('/entry-edit/' + entry.id + '?from=browse');
    },
    openUrl(entry) {
      if (entry.url) chrome.tabs.create({ url: entry.url });
    },
    newEntry() {
      this.$router.route('/entry-edit/new');
    },
    // --- Group management ---
    startRename(group) {
      this.renamingGroup = group.name;
      this.renameInput = group.name;
      this.$nextTick(() => this.$refs.renameInput?.focus());
    },
    async confirmRename(group) {
      let newName = this.renameInput.trim();
      if (!newName || newName === group.name) { this.renamingGroup = null; return; }
      this.busy = true;
      this.message = 'Renaming...';
      try {
        let buf = await this.keepassService.renameGroup(group.name, newName);
        await this.keepassService.uploadDatabase(buf);
        // Update cache: rename groupName on all entries in the group
        let all = this.unlockedState.cacheGet('allEntries') || [];
        all.forEach(e => { if (e.groupName === group.name) e.groupName = newName; });
        this.unlockedState.cacheSet('allEntries', all);
        if (this.$parent?.secureCache) this.$parent.secureCache.save('secureCache.entries', all);
        this.entriesVersion++;
        this.renamingGroup = null;
        this.message = 'Renamed.';
        setTimeout(() => this.message = '', 1500);
      } catch (err) {
        this.message = 'Error: ' + err.message;
      }
      this.busy = false;
    },
    cancelRename() {
      this.renamingGroup = null;
    },
    async confirmDeleteGroup(group) {
      let count = this.getGroupEntries(group.name).length;
      let msg = count > 0
        ? 'Delete group "' + group.name + '" and all ' + count + ' entries?'
        : 'Delete empty group "' + group.name + '"?';
      if (!confirm(msg)) return;
      this.busy = true;
      this.message = 'Deleting...';
      try {
        let buf = await this.keepassService.deleteGroup(group.name);
        await this.keepassService.uploadDatabase(buf);
        // Update cache: remove all entries in the deleted group
        let all = this.unlockedState.cacheGet('allEntries') || [];
        all = all.filter(e => e.groupName !== group.name);
        this.unlockedState.cacheSet('allEntries', all);
        if (this.$parent?.secureCache) this.$parent.secureCache.save('secureCache.entries', all);
        this.entriesVersion++;
        this.message = 'Deleted.';
        setTimeout(() => this.message = '', 1500);
      } catch (err) {
        this.message = 'Error: ' + err.message;
      }
      this.busy = false;
    },
    startNewGroup() {
      this.showNewGroup = true;
      this.newGroupName = '';
      this.$nextTick(() => this.$refs.newGroupInput?.focus());
    },
    async confirmNewGroup() {
      let name = this.newGroupName.trim();
      if (!name) { this.showNewGroup = false; return; }
      this.busy = true;
      this.message = 'Creating...';
      try {
        let buf = await this.keepassService.createGroup(name);
        await this.keepassService.uploadDatabase(buf);
        // No entry changes needed — getGroups() reads from _db which is already updated
        this.entriesVersion++;
        this.showNewGroup = false;
        this.message = 'Created.';
        setTimeout(() => this.message = '', 1500);
      } catch (err) {
        this.message = 'Error: ' + err.message;
      }
      this.busy = false;
    },
    cancelNewGroup() {
      this.showNewGroup = false;
    },
  },
};
</script>

<template>
  <div id="browse-panel">
    <div class="search">
      <i class="fa fa-search" />
      <input v-model="searchTerm" type="search" placeholder="search entire database..." />
      <i class="fa fa-plus add-entry" @click="newEntry" title="New entry" />
    </div>
    <div class="browse-groups">
      <div v-for="group in groups" :key="group.name" class="group-section">
        <div class="group-header" @click="toggleGroup(group.name)">
          <i :class="['fa', expandedGroups[group.name] ? 'fa-folder-open' : 'fa-folder', 'fa-fw']" />
          <span v-if="renamingGroup !== group.name" class="group-name">{{ group.name }}</span>
          <span v-else class="rename-field">
            <input
              ref="renameInput"
              v-model="renameInput"
              class="group-name-input"
              @click.stop
              @keyup.enter="confirmRename(group)"
              @keyup.escape="cancelRename"
            />
            <i class="fa fa-check confirm-icon" @click.stop="confirmRename(group)" title="Confirm" />
          </span>
          <span class="action-icons" @click.stop>
            <i class="fa fa-pencil group-edit-icon" @click="startRename(group)" title="Rename group" />
            <i class="fa fa-trash group-delete-icon" @click="confirmDeleteGroup(group)" title="Delete group" />
          </span>
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
            <span class="fa-stack entry-url" @click.stop="openUrl(entry)">
              <i class="fa fa-circle fa-stack-2x" />
              <i class="fa fa-external-link fa-stack-1x fa-inverse" />
            </span>
            <span class="fa-stack entry-edit" @click.stop="editEntry(entry)">
              <i class="fa fa-circle fa-stack-2x" />
              <i class="fa fa-pencil fa-stack-1x fa-inverse" />
            </span>
          </div>
        </div>
      </div>
      <!-- New Group -->
      <div class="new-group-area">
        <div v-if="showNewGroup" class="new-group-form">
          <input
            ref="newGroupInput"
            v-model="newGroupName"
            placeholder="Group name..."
            class="new-group-input"
            @keyup.enter="confirmNewGroup"
            @keyup.escape="cancelNewGroup"
          />
          <i class="fa fa-check confirm-icon" @click="confirmNewGroup" title="Confirm" />
        </div>
        <div v-else class="new-group-btn selectable" @click="startNewGroup">
          <i class="fa fa-plus" /> New Group
        </div>
      </div>
    </div>
    <transition name="toast">
      <div v-if="message" class="status-toast">{{ message }}</div>
    </transition>
  </div>
</template>

<style lang="scss" scoped>
@import '../styles/settings.scss';

.search {
  padding: 8px $wall-padding;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  border-bottom: 2px solid $light-gray;
  input {
    float: right;
    width: 96%;
    border: 0px;
    padding: 0px;
    padding-left: 10px;
    font-size: 18px;
    background-color: $background-color;
    &:focus { outline: none; }
  }
  .fa {
    width: 4%;
    font-size: 15px;
  }
  .add-entry {
    font-size: 18px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 3px;
    &:hover { background: $light-background-color; }
  }
}

.browse-groups {
  height: 350px;
  overflow-y: auto;
  border-bottom: 2px solid $light-gray;
}

.group-header {
  padding: 8px $wall-padding;
  border-bottom: 1px solid $light-gray;
  background: $light-background-color;
  display: flex; align-items: center; gap: 6px;
  cursor: pointer;
  &:hover { opacity: 0.7; }
  .group-name { font-weight: 600; font-size: 14px; flex: 1; }
  .group-count { font-size: 12px; color: var(--tusk-text-muted); }
  .action-icons {
    display: flex; align-items: center; gap: 4px;
    margin-left: 8px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  &:hover .action-icons { opacity: 1; }
  .group-edit-icon, .group-delete-icon {
    font-size: 12px;
    padding: 3px 4px;
    border-radius: 2px;
    color: var(--tusk-icon-muted);
    &:hover { color: var(--tusk-text); background: $light-gray; }
  }
  .group-delete-icon:hover { color: var(--tusk-delete-hover); }
  .rename-field {
    display: flex; align-items: center; gap: 4px; flex: 1;
  }
  .group-name-input {
    font-weight: 600;
    font-size: 14px;
    border: 1px solid $blue;
    border-radius: 3px;
    padding: 2px 6px;
    width: 120px;
    &:focus { outline: none; }
  }
}

.confirm-icon {
  font-size: 13px;
  color: $green;
  cursor: pointer;
  flex-shrink: 0;
  &:hover { opacity: 0.7; }
}

.group-entries {
  .entry-row {
    display: flex; align-items: center;
    padding: 8px $wall-padding;
    border-bottom: 1px solid var(--tusk-border-light);
    &:hover { background: var(--tusk-bg-hover); }
    .entry-info {
      flex: 1;
      .entry-title { font-size: 14px; display: block; }
      .entry-user { font-size: 11px; color: var(--tusk-text-subtle); }
    }
    .entry-url,
    .entry-edit { opacity: 0.3; font-size: 16px; &:hover { opacity: 0.8; } }
  }
}

.new-group-area {
  border-top: 2px solid $light-gray;
}
.new-group-btn {
  padding: 10px $wall-padding;
  text-align: center;
  font-size: 13px;
  color: $blue;
  cursor: pointer;
  &:hover { background: var(--tusk-bg-hover); }
  .fa { margin-right: 4px; }
}
.new-group-form {
  padding: 8px $wall-padding;
  display: flex; align-items: center; gap: 6px;
}
.new-group-input {
  flex: 1;
  box-sizing: border-box;
  padding: 8px;
  border: 1px solid $blue;
  border-radius: 3px;
  font-size: 14px;
  &:focus { outline: none; }
}

.status-toast {
  position: absolute;
  bottom: 0;
  left: 0; right: 0;
  padding: 6px $wall-padding;
  font-size: 12px;
  color: var(--tusk-svg-fill);
  background: rgba(0,0,0,0.7);
  text-align: center;
  z-index: 10;
  pointer-events: none;
}
.toast-enter-active, .toast-leave-active {
  transition: opacity 0.2s;
}
.toast-enter-from, .toast-leave-to {
  opacity: 0;
}

#browse-panel {
  position: relative;
}
</style>
