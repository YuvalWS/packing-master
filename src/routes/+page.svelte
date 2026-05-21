<script lang="ts">
  // Placeholder home — actual trips list ships in step 3.2.
</script>

<section class="placeholder" aria-busy="true">
  <div class="skeleton-card"></div>
  <div class="skeleton-card"></div>
  <div class="skeleton-card"></div>
</section>

<style>
  .placeholder {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-block-start: var(--space-4);
  }

  .skeleton-card {
    height: 96px;
    border-radius: var(--radius-md);
    background: linear-gradient(
      90deg,
      var(--color-surface) 0%,
      var(--color-border) 50%,
      var(--color-surface) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }
</style>
