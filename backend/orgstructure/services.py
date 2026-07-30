from .models import Position


def get_subtree_position_ids(position_id):
    """All Position ids in the reporting subtree rooted at position_id,
    including position_id itself. Used both by Manager permission checks
    and by the Team Skills Matrix / Gap Analysis endpoints.
    """
    ids = {position_id}
    frontier = [position_id]
    while frontier:
        children = list(Position.objects.filter(parent_position_id__in=frontier).values_list('id', flat=True))
        new_ids = [c for c in children if c not in ids]
        if not new_ids:
            break
        ids.update(new_ids)
        frontier = new_ids
    return ids
