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
                    marks={j: str(j) for j in range(0, 11)},
                    tooltip={"placement": "bottom", "always_visible": True}
                )
            ], style={"marginBottom": "20px"}) for i in [5, 6, 7, 0]  # Relaxation, Relationships, Spirituality, Health
        ], style={"width": "25%", "display": "inline-block", "verticalAlign": "top", "padding": "10px"}),

        # Graph in the center
        html.Div([
            dcc.Graph(id="wheel-graph", style={"width": "100%", "height": "60vh"})
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
                    marks={j: str(j) for j in range(0, 11)},
                    tooltip={"placement": "bottom", "always_visible": True}
                )
            ], style={"marginBottom": "20px"}) for i in [4, 3, 2, 1]  # Career, Family, Finance, Personal Growth
        ], style={"width": "25%", "display": "inline-block", "verticalAlign": "top", "padding": "10px"})
    ], style={"display": "flex", "justifyContent": "center", "alignItems": "center", "width": "100%"}),
])

# Callback to update the Wheel of Life graph and bar graphs based on slider inputs
@app.callback(
    Output("wheel-graph", "figure"),
    [Input(f"slider-{i}", "value") for i in range(len(define_categories))]
)
def update_graph(*values):
    scores = list(values) + [values[0]]  # Ensure the graph is circular
    categories_with_closure = define_categories + [define_categories[0]]

    # Wheel of Life Graph
    wheel_fig = go.Figure()
    wheel_fig.add_trace(go.Scatterpolar(
        r=scores,
        theta=categories_with_closure,
        fill='none',
        line=dict(color='teal', width=2),
        marker=dict(size=6)
    ))

    wheel_fig.update_layout(
        polar=dict(
            angularaxis=dict(
                direction="clockwise",
                rotation=90,
                tickmode="array",
                tickvals=[i * (360 / len(define_categories)) for i in range(len(define_categories))],
                ticktext=define_categories,
                tickfont=dict(size=14, family="serif", color="teal"),
                showline=True,
                linewidth=2,
                linecolor="teal"
            ),
            radialaxis=dict(
                visible=True,
                range=[0, 10],
                tickfont=dict(size=12, family="serif", color="teal"),
                showline=True,
                linewidth=2,
                linecolor="teal",
                gridcolor="teal"
            )
        ),
        showlegend=False,
        margin=dict(l=40, r=40, t=40, b=40),
        paper_bgcolor="#FFF8EF"
    )

    return wheel_fig

# Run the app
if __name__ == "__main__":
    app.run_server(debug=True)
