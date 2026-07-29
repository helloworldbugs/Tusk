<script>
import GoBack from '@/components/GoBack.vue';

export default {
  components: { GoBack },
  props: {
    unlockedState: Object,
    keepassService: Object,
    settings: Object,
    links: Object,
  },
  data() {
    return {
      entry: null,
      editFields: {},
      saving: false,
      message: '',
    };
  },
  mounted() {
    let entryId = this.$router.getRoute().entryId;
    this.entry = this.unlockedState.cacheGet('allEntries').filter((entry) => {
      return entry.id == entryId;
    })[0];
    if (!this.entry) return;
    // Copy editable fields
    let editableKeys = ['title', 'userName', 'url', 'notes', 'password'];
    for (let key of editableKeys) {
      if (key === 'password') {
        this.editFields[key] = this.unlockedState.getDecryptedAttribute(this.entry, key);
      } else {
        this.editFields[key] = this.entry[key] || '';
      }
    }
  },
  methods: {
    async save() {
      this.saving = true;
      this.message = 'Saving...';
      try {
        console.log('[EntryEdit] save called');
        console.log('[EntryEdit] keepassService:', !!this.keepassService);
        console.log('[EntryEdit] saveEntry method:', typeof this.keepassService.saveEntry);
        let newBuffer = await this.keepassService.saveEntry(this.entry.id, this.editFields);
        console.log('[EntryEdit] saveEntry returned, type:', typeof newBuffer, 'size:', newBuffer && newBuffer.byteLength);
        
        this.message = 'Uploading to server...';
        await this.keepassService.uploadDatabase(newBuffer);
        
        this.message = 'Saved!';
        setTimeout(() => this.$router.route('/'), 1000);
      } catch (err) {
        console.error(err);
        this.message = 'Error: ' + err.message;
      }
      this.saving = false;
    },
    cancel() {
      this.$router.route('/entry-details/' + this.entry.id);
    },
  },
};
</script>

<template>
  <div>
    <go-back message="back" />
    <div class="edit-form" v-if="entry">
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

.edit-field {
  margin-bottom: 12px;
  label {
    display: block;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 4px;
    color: #555;
  }
  input, textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 8px;
    border: 1px solid $light-gray;
    border-radius: 3px;
    font-size: 14px;
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
