<script>
import GoBack from '@/components/GoBack.vue';

export default {
  components: { GoBack },
  props: {
    unlockedState: Object,
    keepassService: Object,
    secureCache: Object,
    settings: Object,
    links: Object,
  },
  data() {
    return {
      entry: null,
      isNew: false,
      editFields: {},
      groups: [],
      selectedGroup: '',
      saving: false,
      message: '',
      deleteClick: 0,   // 0=not clicked, 1=clicked once (show confirm), 2=delete now
      fromBrowse: false,
      deleting: false,
    };
  },
  mounted() {
    let route = this.$router.getRoute();
    let rawEntryId = route.entryId || '';
    // Strip query params from entryId (e.g. "abc123?from=browse" → "abc123")
    let qIdx = rawEntryId.indexOf('?');
    let entryId = qIdx >= 0 ? rawEntryId.substring(0, qIdx) : rawEntryId;
    let queryStr = qIdx >= 0 ? rawEntryId.substring(qIdx + 1) : '';
    this.fromBrowse = queryStr.indexOf('from=browse') >= 0;
    if (entryId === 'new') {
      this.isNew = true;
      this.editFields = { title: '', userName: '', url: '', notes: '', password: '' };
    } else {
      this.entry = this.unlockedState.cacheGet('allEntries').filter((entry) => {
        return entry.id == entryId;
      })[0];
      if (this.entry) {
        let editableKeys = ['title', 'userName', 'url', 'notes', 'password'];
        for (let key of editableKeys) {
          if (key === 'password') {
            this.editFields[key] = this.unlockedState.getDecryptedAttribute(this.entry, key);
          } else {
            this.editFields[key] = this.entry[key] || '';
          }
        }
      }
    }
    // Load sorted groups from cached entries + keepassService
    let allEntries = this.unlockedState.cacheGet('allEntries') || [];
    let groupNames = {};
    allEntries.forEach(function(e) { if (e.groupName) groupNames[e.groupName] = true; });
    let dbGroups = this.keepassService.getGroups() || [];
    dbGroups.forEach(function(g) { groupNames[g.name] = true; });
    this.groups = Object.keys(groupNames).sort();
    this.selectedGroup = this.entry?.groupName || this.groups[0] || '';
    if (this.isNew && this.groups[0]) this.selectedGroup = this.groups[0];
  },
  methods: {
    async save() {
      this.saving = true;
      this.message = 'Saving...';
      try {
        let newBuffer;
        if (this.isNew) {
          newBuffer = await this.keepassService.addEntry(this.selectedGroup, this.editFields);
        } else {
          if (this.selectedGroup !== this.entry.groupName) {
            await this.keepassService.moveEntryToGroup(this.entry.id, this.selectedGroup);
            this.entry.groupName = this.selectedGroup;
          }
          newBuffer = await this.keepassService.saveEntry(this.entry.id, this.editFields);
        }
        console.log('[EntryEdit] saveEntry returned, type:', typeof newBuffer, 'size:', newBuffer && newBuffer.byteLength);
        
        this.message = 'Uploading...';
        await this.keepassService.uploadDatabase(newBuffer);
        
        // Update cache
        if (!this.isNew) {
          // Existing entry: update in-place
          let allEntries = this.unlockedState.cacheGet('allEntries');
          let priEntries = this.unlockedState.cacheGet('priorityEntries');
          let updateEntry = (list) => {
            if (!list) return;
            let idx = list.findIndex(e => e.id === this.entry.id);
            if (idx >= 0) {
              for (let key in this.editFields) {
                if (key === 'password') {
                  list[idx].protectedData = list[idx].protectedData || {};
                } else {
                  list[idx][key] = this.editFields[key];
                }
              }
            }
          };
          updateEntry(allEntries);
          updateEntry(priEntries);
          this.unlockedState.cacheSet('allEntries', allEntries);
          this.unlockedState.cacheSet('priorityEntries', priEntries);
          if (this.secureCache) {
            this.secureCache.save('secureCache.entries', allEntries);
          }
        } else {
          // New entry: clear cache so Unlock re-downloads fresh data on next mount
          this.unlockedState.clearCache();
          if (this.secureCache) {
            this.secureCache.clear('secureCache.entries');
          }
        }
        
        this.message = 'Saved!';
        setTimeout(() => this.$router.goBack(), 800);
      } catch (err) {
        console.error(err);
        this.message = 'Error: ' + err.message;
      }
      this.saving = false;
    },
    cancel() {
      this.$router.goBack();
    },
    async deleteEntry() {
      if (this.deleteClick === 0) {
        this.deleteClick = 1;
        this.message = '';
        return;
      }
      this.deleting = true;
      this.message = 'Deleting...';
      try {
        let newBuffer = await this.keepassService.deleteEntry(this.entry.id);
        await this.keepassService.uploadDatabase(newBuffer);
        // Remove from cache
        let allEntries = this.unlockedState.cacheGet('allEntries') || [];
        let idx = allEntries.findIndex(e => e.id === this.entry.id);
        if (idx >= 0) allEntries.splice(idx, 1);
        this.unlockedState.cacheSet('allEntries', allEntries);
        if (this.secureCache) this.secureCache.save('secureCache.entries', allEntries);
        this.$router.goBack();
      } catch (err) {
        this.message = 'Delete error: ' + err.message;
        this.deleteClick = 0;
      }
      this.deleting = false;
    },
  },
};
</script>

<template>
  <div>
    <go-back message="back to entry list">
      <template v-if="!isNew" #extra>
        <span class="delete-btn selectable" @click.stop="deleteEntry" title="Delete entry">
          <i class="fa fa-trash" />
          <span v-if="deleteClick === 0"> Delete</span>
          <span v-if="deleteClick === 1" class="confirm-text">Click again to confirm</span>
        </span>
      </template>
    </go-back>
    <div class="edit-form" v-if="entry || isNew">
      <div class="edit-field">
        <label>Group</label>
        <select v-model="selectedGroup">
          <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>
      <div class="edit-field">
        <label>Title</label>
        <input v-model="editFields.title" type="text" />
      </div>
      <div class="edit-field">
        <label>Username</label>
        <input v-model="editFields.userName" type="text" />
      </div>
      <div class="edit-field">
        <label>Password</label>
        <input v-model="editFields.password" type="text" />
      </div>
      <div class="edit-field">
        <label>URL</label>
        <input v-model="editFields.url" type="text" />
      </div>
      <div class="edit-field">
        <label>Notes</label>
        <textarea v-model="editFields.notes" rows="4"></textarea>
      </div>
      <div class="edit-actions">
        <button class="action-button" :disabled="saving" @click="save">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
        <button class="action-button cancel" @click="cancel">Cancel</button>
      </div>
      <div class="message" v-if="message">{{ message }}</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import '../styles/settings.scss';

.edit-form {
  padding: $wall-padding;
}

.delete-btn {
  color: var(--tusk-red);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  &:hover { opacity: 0.7; }
  .confirm-text {
    color: var(--tusk-red);
    font-weight: 700;
  }
}

.edit-field {
  margin-bottom: 12px;
  label {
    display: block;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 4px;
    color: var(--tusk-text-subtle);
  }
  input, textarea, select {
    width: 100%;
    box-sizing: border-box;
    padding: 8px;
    border: 1px solid $light-gray;
    border-radius: 3px;
    font-size: 14px;
    color: $text-color;
    background: $light-background-color;
    &:focus { outline: none; border-color: $blue; }
  }
}

.edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  button {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 3px;
    font-size: 14px;
    cursor: pointer;
    &:disabled { opacity: 0.5; }
  }
  .action-button { background: $blue; color: var(--tusk-svg-fill); }
  .cancel { background: $light-gray; color: var(--tusk-text); }
}

.message {
  margin-top: 12px;
  padding: 8px;
  background: $light-background-color;
  border-radius: 3px;
  font-size: 13px;
}

.error { color: red; }
</style>
