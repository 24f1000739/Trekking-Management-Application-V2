from flask_wtf import FlaskForm
from wtforms import (
    BooleanField,
    DateField,
    IntegerField,
    PasswordField,
    SelectField,
    StringField,
    SubmitField,
    TextAreaField,
)
from wtforms.validators import (
    DataRequired,
    Email,
    EqualTo,
    Length,
    NumberRange,
    Optional,
    ValidationError,
)


class LoginForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    remember_me = BooleanField('Remember Me')
    submit = SubmitField('Login')


class RegisterUserForm(FlaskForm):
    name = StringField('Full Name', validators=[DataRequired(), Length(min=2, max=120)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    phone = StringField('Phone', validators=[DataRequired(), Length(min=10, max=20)])
    password = PasswordField(
        'Password', validators=[DataRequired(), Length(min=8, max=128)]
    )
    confirm_password = PasswordField(
        'Confirm Password',
        validators=[DataRequired(), EqualTo('password', message='Passwords must match.')],
    )
    submit = SubmitField('Register as Trekker')


class RegisterStaffForm(FlaskForm):
    name = StringField('Full Name', validators=[DataRequired(), Length(min=2, max=120)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    phone = StringField('Phone', validators=[DataRequired(), Length(min=10, max=20)])
    password = PasswordField(
        'Password', validators=[DataRequired(), Length(min=8, max=128)]
    )
    confirm_password = PasswordField(
        'Confirm Password',
        validators=[DataRequired(), EqualTo('password', message='Passwords must match.')],
    )
    submit = SubmitField('Register as Trek Staff')


class TrekForm(FlaskForm):
    name = StringField('Trek Name', validators=[DataRequired(), Length(max=150)])
    location = StringField('Location', validators=[DataRequired(), Length(max=150)])
    difficulty = SelectField(
        'Difficulty',
        choices=[('Easy', 'Easy'), ('Moderate', 'Moderate'), ('Hard', 'Hard')],
        validators=[DataRequired()],
    )
    duration = IntegerField(
        'Duration (days)', validators=[DataRequired(), NumberRange(min=1)]
    )
    total_slots = IntegerField(
        'Total Slots', validators=[DataRequired(), NumberRange(min=1)]
    )
    available_slots = IntegerField(
        'Available Slots', validators=[DataRequired(), NumberRange(min=0)]
    )
    status = SelectField(
        'Status',
        choices=[
            ('Pending', 'Pending'),
            ('Approved', 'Approved'),
            ('Open', 'Open'),
            ('Closed', 'Closed'),
            ('Completed', 'Completed'),
        ],
        validators=[DataRequired()],
    )
    start_date = DateField('Start Date', validators=[DataRequired()], format='%Y-%m-%d')
    end_date = DateField('End Date', validators=[DataRequired()], format='%Y-%m-%d')
    description = TextAreaField('Description', validators=[Optional()])
    assigned_staff_id = SelectField('Assign Staff', coerce=int, validators=[Optional()])
    submit = SubmitField('Save Trek')

    def validate_end_date(self, field):
        if self.start_date.data and field.data:
            if field.data <= self.start_date.data:
                raise ValidationError('End date must be after start date.')

    def validate_available_slots(self, field):
        if self.total_slots.data is not None and field.data is not None:
            if field.data > self.total_slots.data:
                raise ValidationError(
                    'Available slots cannot exceed total slots.'
                )


class StaffTrekUpdateForm(FlaskForm):
    available_slots = IntegerField(
        'Available Slots', validators=[DataRequired(), NumberRange(min=0)]
    )
    status = SelectField(
        'Status',
        choices=[('Open', 'Open'), ('Closed', 'Closed')],
        validators=[DataRequired()],
    )
    submit = SubmitField('Update Trek')


class ProfileForm(FlaskForm):
    name = StringField('Full Name', validators=[DataRequired(), Length(min=2, max=120)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    phone = StringField('Phone', validators=[DataRequired(), Length(min=10, max=20)])
    submit = SubmitField('Update Profile')


class SearchForm(FlaskForm):
    query = StringField('Search', validators=[Optional()])
    submit = SubmitField('Search')


class TrekFilterForm(FlaskForm):
    location = StringField('Location', validators=[Optional()])
    difficulty = SelectField(
        'Difficulty',
        choices=[
            ('', 'All Difficulties'),
            ('Easy', 'Easy'),
            ('Moderate', 'Moderate'),
            ('Hard', 'Hard'),
        ],
        validators=[Optional()],
    )
    submit = SubmitField('Filter')


class AssignStaffForm(FlaskForm):
    assigned_staff_id = SelectField(
        'Assign Staff', coerce=int, validators=[DataRequired()]
    )
    submit = SubmitField('Assign Staff')
