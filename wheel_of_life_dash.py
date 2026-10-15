import math

import dash
from dash import dcc, html
from dash.dependencies import Input, Output
import plotly.graph_objects as go

# Canonical category order: clockwise around the wheel starting at 12 o'clock.
# Everything (slider IDs, callback inputs, wheel geometry) derives from this list.
CATEGORIES = [
    "Health", "Personal Growth", "Finance", "Family",
    "Career", "Relaxation", "Relationships", "Spirituality"
]
LEFT_ORDER = ["Relaxation", "Relationships", "Spirituality", "Health"]
RIGHT_ORDER = ["Career", "Family", "Finance", "Personal Growth"]
DEFAULT_SCORE = 5


def slider_id(category):
    return "slider-" + category.lower().replace(" ", "-")


# Wheel geometry. Angles are degrees measured clockwise from 12 o'clock.
# The wheel has eight equal 45-degree sectors: spokes sit on sector
# boundaries (0, 45, 90, ...) and each category, its label and its score
# vertex sit on the sector's centre line (22.5, 67.5, ...).
NUM_RINGS = 10
SECTOR_WIDTH = 360 / len(CATEGORIES)
CATEGORY_ANGLES = [SECTOR_WIDTH * (i + 0.5) for i in range(len(CATEGORIES))]
SPOKE_ANGLES = [SECTOR_WIDTH * i for i in range(len(CATEGORIES))]
LABEL_RADIUS = NUM_RINGS + 0.85
AXIS_LIMIT = NUM_RINGS + 2.0

CREAM = "#F8F1E4"
TEAL = "#2F8C8C"
NAVY = "#1F2A44"
FILL = "rgba(47, 140, 140, 0.45)"
SERIF = "Georgia, 'Times New Roman', serif"


def polar_to_xy(r, angle_deg):
    rad = math.radians(angle_deg)
    return r * math.sin(rad), r * math.cos(rad)


def tangent_text_angle(angle_deg):
    """Rotation that lays text along the circle and keeps it upright."""
    a = angle_deg % 360
    if 90 < a < 270:
        return a - 180
    return a if a <= 90 else a - 360


def make_wheel_figure(scores):
    """Build the wheel for scores given in CATEGORIES order."""
    fig = go.Figure()

    xs, ys = zip(*(polar_to_xy(s, a) for s, a in zip(scores, CATEGORY_ANGLES)))
    fig.add_trace(go.Scatter(
        x=list(xs) + [xs[0]],
        y=list(ys) + [ys[0]],
        mode="lines+markers",
        fill="toself",
        fillcolor=FILL,
        line=dict(color=TEAL, width=2),
        marker=dict(size=7, color=TEAL),
        text=CATEGORIES + [CATEGORIES[0]],
        customdata=list(scores) + [scores[0]],
        hovertemplate="%{text}: %{customdata}<extra></extra>",
    ))

    # Grid is drawn above the fill so rings stay readable through the score area
    shapes = [
        dict(type="circle", xref="x", yref="y", x0=-r, y0=-r, x1=r, y1=r,
             line=dict(color=TEAL, width=2.5 if r == NUM_RINGS else 1), layer="above")
        for r in range(1, NUM_RINGS + 1)
    ]
    for a in SPOKE_ANGLES:
        x1, y1 = polar_to_xy(NUM_RINGS, a)
        shapes.append(dict(type="line", xref="x", yref="y", x0=0, y0=0, x1=x1, y1=y1,
                           line=dict(color=TEAL, width=1.5), layer="above"))

    annotations = []
    for category, a in zip(CATEGORIES, CATEGORY_ANGLES):
        x, y = polar_to_xy(LABEL_RADIUS, a)
        annotations.append(dict(
            x=x, y=y, xref="x", yref="y", text=category.upper(), showarrow=False,
            textangle=tangent_text_angle(a), xanchor="center", yanchor="middle",
            font=dict(family=SERIF, size=17, color=NAVY),
        ))
    # Ring values 1-10 along the 3 o'clock spoke, nudged above the line
    for r in range(1, NUM_RINGS + 1):
        annotations.append(dict(
            x=r - 0.1, y=0.08, xref="x", yref="y", text=str(r), showarrow=False,
            xanchor="right", yanchor="bottom",
            font=dict(family=SERIF, size=11, color=TEAL),
        ))

    axis = dict(range=[-AXIS_LIMIT, AXIS_LIMIT], visible=False, fixedrange=True)
    fig.update_layout(
        shapes=shapes,
        annotations=annotations,
        xaxis=axis,
        yaxis=dict(axis, scaleanchor="x", scaleratio=1),
        showlegend=False,
        margin=dict(l=0, r=0, t=0, b=0),
        paper_bgcolor=CREAM,
        plot_bgcolor=CREAM,
        dragmode=False,
    )
    return fig


def slider_block(category):
    return html.Div([
        html.Label(category, htmlFor=slider_id(category), className="slider-label"),
        dcc.Slider(
            id=slider_id(category),
            min=0,
            max=10,
            step=1,
            value=DEFAULT_SCORE,
            marks={j: str(j) for j in range(0, 11)},
            tooltip={"placement": "bottom", "always_visible": True},
        ),
    ], className="slider-block")


app = dash.Dash(__name__, title="Wheel of Life")

app.layout = html.Div([
    html.H1("WHEEL OF LIFE", className="title"),
    html.Div([
        html.Div([slider_block(c) for c in LEFT_ORDER], className="slider-column"),
        html.Div([
            dcc.Graph(
                id="wheel-graph",
                figure=make_wheel_figure([DEFAULT_SCORE] * len(CATEGORIES)),
                config={"displayModeBar": False, "responsive": True},
                className="wheel-graph",
                style={"width": "100%", "height": "90vh"},
            )
        ], className="wheel-column"),
        html.Div([slider_block(c) for c in RIGHT_ORDER], className="slider-column"),
    ], className="main-band"),
], className="page")


@app.callback(
    Output("wheel-graph", "figure"),
    [Input(slider_id(c), "value") for c in CATEGORIES],
)
def update_graph(*values):
    return make_wheel_figure([DEFAULT_SCORE if v is None else v for v in values])


if __name__ == "__main__":
    app.run(debug=True)
