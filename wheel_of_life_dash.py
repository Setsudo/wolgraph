import math

import dash
from dash import dcc, html
from dash.dependencies import Input, Output
import plotly.graph_objects as go

# Initialize the Dash app
app = dash.Dash(__name__)

# Define the categories for the Wheel of Life
define_categories = [
    "Health", "Personal Growth", "Finance", "Family",
    "Career", "Relaxation", "Relationships", "Spirituality"
]

# Define initial scores for the Wheel of Life
initial_scores = [5, 5, 5, 5, 5, 5, 5, 5]

# Create the layout of the app
app.layout = html.Div([
    html.H1("WHEEL OF LIFE", style={"textAlign": "center", "fontFamily": "serif", "fontWeight": "bold"}),

    # Sliders, bar graphs, and central circle graph in one band
    html.Div([
        # Left side sliders
        html.Div([
            html.Div([
                html.Label(define_categories[i], style={"fontFamily": "serif", "fontSize": "16px", "color": "teal"}),
                dcc.Slider(
                    id=f"slider-{i}",
                    min=0,
                    max=10,
                    step=1,
                    value=initial_scores[i],
                    marks={j: str(j) for j in range(0, 11)},  # Add "0" back to the sliders
                    tooltip={"placement": "bottom", "always_visible": True}
                )
            ], style={"marginBottom": "20px"}) for i in [5, 6, 7, 0]  # Relaxation, Relationships, Spirituality, Health
        ], style={"width": "25%", "display": "inline-block", "verticalAlign": "top", "padding": "10px"}),

        # Graph in the center
        html.Div([
            dcc.Graph(id="wheel-graph", style={"width": "100%", "height": "90vh"})
        ], style={"width": "50%", "display": "inline-block", "verticalAlign": "top"}),

        # Right side sliders
        html.Div([
            html.Div([
                html.Label(define_categories[i], style={"fontFamily": "serif", "fontSize": "16px", "color": "teal"}),
                dcc.Slider(
                    id=f"slider-{i}",
                    min=0,
                    max=10,
                    step=1,
                    value=initial_scores[i],
                    marks={j: str(j) for j in range(0, 11)},  # Add "0" back to the sliders
                    tooltip={"placement": "bottom", "always_visible": True}
                )
            ], style={"marginBottom": "20px"}) for i in [4, 3, 2, 1]  # Career, Family, Finance, Personal Growth
        ], style={"width": "25%", "display": "inline-block", "verticalAlign": "top", "padding": "10px"})
    ], style={"display": "flex", "justifyContent": "center", "alignItems": "center", "width": "100%"}),
])

# Wheel geometry. Angles are degrees measured clockwise from 12 o'clock.
# The wheel has eight equal 45-degree sectors: spokes sit on sector
# boundaries (0, 45, 90, ...) and each category, its label and its score
# vertex sit on the sector's centre line (22.5, 67.5, ...).
NUM_RINGS = 10
SECTOR_WIDTH = 360 / len(define_categories)
CATEGORY_ANGLES = [SECTOR_WIDTH * (i + 0.5) for i in range(len(define_categories))]
SPOKE_ANGLES = [SECTOR_WIDTH * i for i in range(len(define_categories))]
LABEL_RADIUS = NUM_RINGS + 0.9
AXIS_LIMIT = NUM_RINGS + 2.6

CREAM = "#F8F1E4"
TEAL = "#2F8C8C"
NAVY = "#1F2A44"
FILL = "rgba(47, 140, 140, 0.45)"


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
        text=define_categories + [define_categories[0]],
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
    for category, a in zip(define_categories, CATEGORY_ANGLES):
        x, y = polar_to_xy(LABEL_RADIUS, a)
        annotations.append(dict(
            x=x, y=y, xref="x", yref="y", text=category.upper(), showarrow=False,
            textangle=tangent_text_angle(a), xanchor="center", yanchor="middle",
            font=dict(family="Georgia, serif", size=15, color=NAVY),
        ))
    # Ring values 1-10 along the 3 o'clock spoke, nudged above the line
    for r in range(1, NUM_RINGS + 1):
        annotations.append(dict(
            x=r - 0.1, y=0.08, xref="x", yref="y", text=str(r), showarrow=False,
            xanchor="right", yanchor="bottom",
            font=dict(family="Georgia, serif", size=11, color=TEAL),
        ))

    axis = dict(range=[-AXIS_LIMIT, AXIS_LIMIT], visible=False, fixedrange=True)
    fig.update_layout(
        shapes=shapes,
        annotations=annotations,
        xaxis=axis,
        yaxis=dict(axis, scaleanchor="x", scaleratio=1),
        showlegend=False,
        margin=dict(l=10, r=10, t=10, b=10),
        paper_bgcolor=CREAM,
        plot_bgcolor=CREAM,
    )
    return fig


@app.callback(
    Output("wheel-graph", "figure"),
    [Input(f"slider-{i}", "value") for i in range(len(define_categories))]
)
def update_graph(*values):
    return make_wheel_figure(values)


# Run the app
if __name__ == "__main__":
    app.run(debug=True)
