import math
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wheel_of_life_dash import (  # noqa: E402
    CATEGORIES, CATEGORY_ANGLES, LEFT_ORDER, NUM_RINGS, RIGHT_ORDER, SPOKE_ANGLES,
    app, make_wheel_figure, slider_id, tangent_text_angle,
)


def category_labels(fig):
    return [a.text for a in fig.layout.annotations if not a.text.isdigit()]


def test_all_eight_category_labels_present():
    fig = make_wheel_figure([5] * 8)
    assert category_labels(fig) == [c.upper() for c in CATEGORIES]


def test_labels_inside_axis_range():
    fig = make_wheel_figure([5] * 8)
    lo, hi = fig.layout.xaxis.range
    for a in fig.layout.annotations:
        assert lo < a.x < hi and lo < a.y < hi


def test_scale_labels_are_1_to_10():
    fig = make_wheel_figure([5] * 8)
    assert [a.text for a in fig.layout.annotations if a.text.isdigit()] == [str(i) for i in range(1, 11)]


def test_rings_and_spokes():
    shapes = make_wheel_figure([5] * 8).layout.shapes
    assert sum(s.type == "circle" for s in shapes) == NUM_RINGS
    assert sum(s.type == "line" for s in shapes) == 8


def test_sector_geometry():
    assert SPOKE_ANGLES == [0, 45, 90, 135, 180, 225, 270, 315]
    assert CATEGORY_ANGLES == [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]


@pytest.mark.parametrize("i", range(8))
def test_each_score_moves_only_its_vertex(i):
    base = make_wheel_figure([5] * 8).data[0]
    scores = [5] * 8
    scores[i] = 9
    moved = make_wheel_figure(scores).data[0]
    changed = [k for k in range(8) if (base.x[k], base.y[k]) != (moved.x[k], moved.y[k])]
    assert changed == [i]
    assert math.hypot(moved.x[i], moved.y[i]) == pytest.approx(9)


def test_polygon_closes_and_zero_sits_at_centre():
    trace = make_wheel_figure([0, 1, 2, 3, 4, 5, 6, 10]).data[0]
    assert (trace.x[0], trace.y[0]) == (trace.x[-1], trace.y[-1])
    assert trace.x[0] == pytest.approx(0) and trace.y[0] == pytest.approx(0)
    assert trace.fill == "toself"


def test_tangent_text_stays_upright():
    for a in CATEGORY_ANGLES:
        assert -90 <= tangent_text_angle(a) <= 90


def test_slider_ids_unique_and_complete():
    assert sorted(LEFT_ORDER + RIGHT_ORDER) == sorted(CATEGORIES)
    ids = [slider_id(c) for c in CATEGORIES]
    assert len(set(ids)) == 8
    layout_ids = []

    def walk(node):
        if getattr(node, "id", None):
            layout_ids.append(node.id)
        children = getattr(node, "children", None)
        for child in children if isinstance(children, list) else [children]:
            if hasattr(child, "to_plotly_json"):
                walk(child)

    walk(app.layout)
    assert sorted(i for i in layout_ids if i.startswith("slider-")) == sorted(ids)
