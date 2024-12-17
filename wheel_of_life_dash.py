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

    # Graph display at the top
    html.Div([
        dcc.Graph(id="wheel-graph", style={"width": "100%", "height": "80vh"})
    ], style={"display": "flex", "justifyContent": "center", "alignItems": "center"}),

    # Add sliders for each category
    html.Div([
        html.Div([
            html.Label(define_categories[i], style={"fontFamily": "serif", "fontSize": "16px", "color": "teal"}),
            dcc.Slider(
                id=f"slider-{i}",
                min=0,
                max=10,
                step=1,
                value=initial_scores[i],
                marks={j: str(j) for j in range(0, 11)}
            )
        ], style={"margin": "10px"}) for i in range(len(define_categories))
    ], style={"width": "80%", "margin": "auto"}),

    # Bottom sections for priority categories and notes
    html.Div([
        html.Div([
            html.H3("priority categories", style={"textAlign": "center", "fontFamily": "serif", "textTransform": "lowercase"}),
            html.Div(style={"border": "1px solid teal", "height": "200px", "margin": "10px"})
        ], style={"width": "45%", "display": "inline-block", "verticalAlign": "top", "paddingRight": "2%"}),

        html.Div([
            html.H3("notes", style={"textAlign": "center", "fontFamily": "serif", "textTransform": "lowercase"}),
            html.Div(style={"border": "1px solid teal", "height": "200px", "margin": "10px"})
        ], style={"width": "45%", "display": "inline-block", "verticalAlign": "top", "paddingLeft": "2%"})
    ])
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
        fill='none',
        line=dict(color='teal', width=2),
        marker=dict(size=6)
    ))

    fig.update_layout(
        polar=dict(
            angularaxis=dict(
                direction="clockwise",
                rotation=90,  # Starts at the top for alignment
                tickmode="array",
                tickvals=[i * (360 / len(define_categories)) for i in range(len(define_categories))],
                ticktext=define_categories,
                tickfont=dict(size=12, family="serif", color="teal"),
                showline=True,
                linewidth=1
            ),
            radialaxis=dict(
                visible=True,
                range=[0, 10],
                tickmode="linear",
                tickangle=0,
                tickfont=dict(size=10, family="serif", color="teal"),
                showline=True,
                linewidth=1,
                gridcolor="teal"
            )
        ),
        showlegend=False,
        margin=dict(l=40, r=40, t=40, b=40),
        paper_bgcolor="#FFF8EF"
    )

    return fig

# Run the app
if __name__ == "__main__":
    app.run_server(debug=True)
