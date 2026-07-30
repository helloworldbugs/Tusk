<script>
export default {
  props: {
    message: String,
  },
};
</script>

<template>
  <div class="box-bar selectable" @click="$router.goBack">
    <span>
      <i class="fa fa-long-arrow-left" aria-hidden="true" />
      {{ message }}
    </span>
    <span class="extra" @click.stop>
      <slot name="extra"></slot>
    </span>
  </div>
</template>

<style lang="scss">
@import '../styles/settings.scss';
.box-bar .extra { float: right; }
</style>
