import React from 'react';
import Timepicker from 'kpc-react/components/timepicker';

export default class Demo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }

    render() {
        return (
            <div>
                <Timepicker value={this.state.time} on$change-value={(c, time) => this.setState({time})} range clearable />
                You selected: {JSON.stringify(this.state.time)}
            </div>
        )
    }
}