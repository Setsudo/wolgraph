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
    html.H1("Wheel of Life Interactive Graph", style={"textAlign": "center"}),

    # Sliders for each category
    html.Div([
        html.Div([
            html.Label(f"{category}"),
            dcc.Slider(
                id=f"slider-{i}",
                min=0,
                max=10,
                step=1,
                value=initial_scores[i],
                marks={i: str(i) for i in range(0, 11)}
            )
        ], style={"padding": "10px"})
        for i, category in enumerate(define_categories)
    ]),

    # Graph display
    dcc.Graph(id="wheel-graph")
])

# Callback to update the Wheel of Life graph based on slider values
@app.callback(
    Output("wheel-graph", "figure"),
    [Input(f"slider-{i}", "value") for i in range(len(define_categories))]
)
def update_graph(*values):
    scores = list(values) + [values[0]]  # Ensure the graph is circular
    categories_with_closure = define_categories + [define_categories[0]]

    fig = go.Figure()
    fig.add_trace(go.Scatterpolar(
        r=scores,
        theta=categories_with_closure,
        fill='toself',
        name="Your Life Balance"
    ))

    fig.update_layout(
        polar=dict(
            radialaxis=dict(visible=True, range=[0, 10])
        ),
        showlegend=False,
        title="Your Wheel of Life"
    )

    return fig

# Run the app
if __name__ == "__main__":
    app.run_server(debug=True)
