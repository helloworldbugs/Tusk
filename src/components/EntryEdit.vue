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
      deleteConfirm: '',
      deleting: false,
    };
  },
  mounted() {
    let entryId = this.$router.getRoute().entryId;
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
        
        // Update both memory cache and secureCache so re-mount doesn't overwrite
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
        // Save to secureCache so Unlock re-mount doesn't reload old data
        if (this.secureCache) {
          this.secureCache.save('secureCache.entries', allEntries);
        }
        
        this.message = 'Saved!';
        setTimeout(() => this.$router.route('/'), 800);
      } catch (err) {
        console.error(err);
        this.message = 'Error: ' + err.message;
      }
      this.saving = false;
    },
    cancel() {
      this.$router.route('/');
    },
    async deleteEntry() {
      if (this.deleteConfirm !== 'yes') {
        this.deleteConfirm = '';
        this.message = 'Type "yes" to confirm deletion';
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
        this.$router.route('/');
      } catch (err) {
        this.message = 'Delete error: ' + err.message;
      }
      this.deleting = false;
    },
  },
};
</script>

<template>
  <div>
    <go-back message="back to entry list" />
    <div class="edit-form" v-if="entry || isNew">
      <div class="edit-header" v-if="!isNew">
        <span class="delete-btn selectable" @click="deleteEntry" title="Delete entry">
          <i class="fa fa-trash" />
        </span>
        <input v-if="deleteConfirm !== ''" v-model="deleteConfirm" placeholder='Type "yes" to delete' class="delete-input" @keyup.enter="deleteEntry" />
      </div>
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

.edit-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
  .delete-btn {
    color: #c00;
    font-size: 16px;
    cursor: pointer;
    &:hover { opacity: 0.7; }
  }
  .delete-input {
    width: 160px;
    padding: 4px 8px;
    border: 1px solid #c00;
    border-radius: 3px;
    font-size: 12px;
  }
}

.edit-field {
  margin-bottom: 12px;
  label {
    display: block;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 4px;
    color: #555;
  }
  input, textarea, select {
    width: 100%;
    box-sizing: border-box;
    padding: 8px;
    border: 1px solid $light-gray;
    border-radius: 3px;
    font-size: 14px;
    background: #fff;
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
  .action-button { background: $blue; color: #fff; }
  .cancel { background: $light-gray; color: #333; }
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
